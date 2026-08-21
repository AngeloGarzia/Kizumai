/**
 * Tests de sécurité auth / ownership (sans DB).
 * Lancer : npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.QUEUE_ENABLED = 'false';
delete process.env.REDIS_URL;
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-access-secret-at-least-32-chars!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-32-chars!';

const { TokenService } = await import('../src/services/TokenService.js');
const { createProjectService } = await import('../src/services/ProjectService.js');
const { createPlannerService } = await import('../src/services/PlannerService.js');
const { assertPasswordStrength } = await import('../src/utils/passwordPolicy.js');
const { UpdateProjectRequestDto } = await import('../src/dto/project.dto.js');
const { CreatePlannerEventRequestDto } = await import('../src/dto/planner.dto.js');
const { config } = await import('../src/config/index.js');

describe('password policy', () => {
  it('rejects short passwords', () => {
    assert.throws(() => assertPasswordStrength('Ab1'), /10/);
  });

  it('rejects passwords without digit', () => {
    assert.throws(() => assertPasswordStrength('abcdefghij'), /lettre et un chiffre/);
  });

  it('accepts strong enough password', () => {
    assert.equal(assertPasswordStrength('abcdefghij1'), 'abcdefghij1');
  });
});

describe('JWT access token rv / typ', () => {
  const user = {
    id: 42,
    email: 'a@example.com',
    refreshTokenVersion: 3,
  };

  it('embeds typ=access and rv', () => {
    const token = TokenService.generateAccessToken(user);
    const payload = jwt.verify(token, config.jwt.accessSecret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
    assert.equal(payload.typ, 'access');
    assert.equal(payload.rv, 3);
    assert.equal(payload.userId, 42);
  });

  it('verifyAccessToken rejects wrong typ', () => {
    const bad = jwt.sign(
      { userId: 1, email: 'x@y.z', typ: 'refresh', rv: 0 },
      config.jwt.accessSecret,
      {
        algorithm: 'HS256',
        expiresIn: '15m',
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        jwtid: 'jti-1',
        notBefore: '0s',
      }
    );
    assert.throws(() => TokenService.verifyAccessToken(bad), /typ|invalide/i);
  });

  it('verifyAccessToken rejects missing rv', () => {
    const bad = jwt.sign(
      { userId: 1, email: 'x@y.z', typ: 'access' },
      config.jwt.accessSecret,
      {
        algorithm: 'HS256',
        expiresIn: '15m',
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        jwtid: 'jti-2',
        notBefore: '0s',
      }
    );
    assert.throws(() => TokenService.verifyAccessToken(bad), /rv|invalide/i);
  });
});

describe('resolveMemoryContext IDOR', () => {
  it('never loads memory without userId even with projectId', async () => {
    let called = false;
    const projectService = createProjectService({
      projectRepository: {
        findById: async () => ({ id: 99, userId: 7 }),
        findByUserId: async () => [],
      },
      activityRepository: {},
      locationRepository: {},
      aiService: {},
      currencyService: { getCurrencyData: async () => ({}) },
      projectMemoryRecallService: {
        buildRecallContext: async () => {
          called = true;
          return { text: 'SECRET' };
        },
      },
    });

    const text = await projectService.previewProject({
      quoi: 'x',
      ou: 'y',
      budget: 1000,
      userId: null,
      projectId: 99,
    }).catch(() => null);

    // preview may throw on incomplete AI — only care that recall was not called
    assert.equal(called, false);
    void text;
  });

  it('rejects foreign projectId for authenticated user', async () => {
    let called = false;
    const projectService = createProjectService({
      projectRepository: {
        findById: async () => ({ id: 99, userId: 7 }),
        findByUserId: async () => [],
      },
      activityRepository: {},
      locationRepository: {},
      aiService: {
        completeProject: async ({ memoryContext }) => {
          assert.equal(memoryContext, '');
          return { quoi: 'q', ou: 'o', budget: 1000, report: 'r', sections: [] };
        },
      },
      currencyService: { getCurrencyData: async () => ({}) },
      projectMemoryRecallService: {
        buildRecallContext: async () => {
          called = true;
          return { text: 'SECRET' };
        },
      },
    });

    await projectService.previewProject({
      quoi: 'x',
      ou: 'y',
      budget: 1000,
      userId: 1,
      projectId: 99,
    });
    assert.equal(called, false);
  });

  it('loads memory only for owned project', async () => {
    let called = false;
    const projectService = createProjectService({
      projectRepository: {
        findById: async () => ({ id: 5, userId: 1 }),
        findByUserId: async () => [],
      },
      activityRepository: {},
      locationRepository: {},
      aiService: {
        completeProject: async ({ memoryContext }) => {
          assert.match(memoryContext, /OWNED/);
          return { quoi: 'q', ou: 'o', budget: 1000, report: 'r', sections: [] };
        },
      },
      currencyService: { getCurrencyData: async () => ({}) },
      projectMemoryRecallService: {
        buildRecallContext: async () => {
          called = true;
          return { text: 'OWNED MEM' };
        },
      },
    });

    await projectService.previewProject({
      quoi: 'x',
      ou: 'y',
      budget: 1000,
      userId: 1,
      projectId: 5,
    });
    assert.equal(called, true);
  });
});

describe('planner project ownership', () => {
  it('blocks create with foreign projectId', async () => {
    const planner = createPlannerService({
      plannerEventRepository: {
        create: async () => {
          throw new Error('should not create');
        },
      },
      projectRepository: {
        findById: async () => ({ id: 9, userId: 2 }),
      },
    });

    await assert.rejects(
      () =>
        planner.create(1, {
          title: 'Rdv',
          startAt: new Date().toISOString(),
          projectId: 9,
        }),
      /introuvable|404/i
    );
  });

  it('allows create with owned projectId', async () => {
    const planner = createPlannerService({
      plannerEventRepository: {
        create: async (row) => ({ id: 1, ...row }),
      },
      projectRepository: {
        findById: async () => ({ id: 9, userId: 1 }),
      },
    });

    const event = await planner.create(1, {
      title: 'Rdv',
      startAt: new Date().toISOString(),
      projectId: 9,
    });
    assert.equal(event.projectId, 9);
  });
});

describe('mass assignment guards', () => {
  it('UpdateProjectRequestDto rejects invalid status', () => {
    assert.throws(
      () => UpdateProjectRequestDto.from({ status: 'superadmin' }),
      /Statut/
    );
  });

  it('CreatePlannerEventRequestDto drops unknown keys', () => {
    const dto = CreatePlannerEventRequestDto.from({
      title: 'x',
      userId: 999,
      role: 'admin',
      startAt: '2020-01-01',
    });
    assert.equal(dto.userId, undefined);
    assert.equal(dto.role, undefined);
    assert.equal(dto.title, 'x');
  });
});
