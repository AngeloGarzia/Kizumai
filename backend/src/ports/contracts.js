/**
 * Contrats (ports) — couplage faible entre couches.
 *
 * Les controllers dépendent de I*Service (pas des repositories).
 * Les services dépendent de I*Repository / autres services injectés.
 * Seul le composition root (`container/`) importe les implémentations concrètes.
 *
 * En JS, les contrats sont documentés ici ; le container injecte les objets
 * qui respectent ces formes.
 */

/**
 * @typedef {object} IUserRepository
 * @property {() => Promise<object[]>} findAll
 * @property {(id: number) => Promise<object|null>} findById
 * @property {(email: string) => Promise<object|null>} findByEmail
 * @property {(data: object) => Promise<object>} create
 * @property {(id: number, data: object) => Promise<object|null>} update
 * @property {(id: number) => Promise<boolean>} delete
 * @property {(id: number, role: string) => Promise<object|null>} updateRole
 * @property {(id: number, plan: string) => Promise<object|null>} updatePlan
 * @property {(role: string) => Promise<object[]>} findByRole
 * @property {(id: number) => Promise<object|null>} incrementRefreshTokenVersion
 */

/**
 * @typedef {object} IUserService
 * @property {() => Promise<object[]>} getAllUsers
 * @property {(id: number) => Promise<object>} getUserById
 * @property {(id: number, data: object) => Promise<object>} updateUser
 * @property {(id: number) => Promise<void>} deleteUser
 */

/**
 * @typedef {object} IAuthService
 * @property {(dto: object, meta?: object) => Promise<{user: object, tokens: object}>} register
 * @property {(dto: object, meta?: object) => Promise<{user: object, tokens: object}>} login
 * @property {(refreshToken: string, meta?: object) => Promise<{user: object, tokens: object}>} refresh
 * @property {(args: {userId?: number|null, refreshToken?: string|null}) => Promise<void>} logout
 * @property {(userId: number) => Promise<object>} upgradeToPaid
 * @property {(accessToken: string) => Promise<object>} getAuthenticatedUser
 */

/**
 * @typedef {object} IProjectService
 * @property {(dto: object) => Promise<object>} previewProject
 * @property {(dto: object) => Promise<object[]>} searchBusinesses
 * @property {(dto: object) => Promise<object[]>} searchTrainings
 * @property {(dto: object) => Promise<object[]>} searchLocations
 * @property {(dto: object) => Promise<{proposals: object[], assessment: object}>} buildProposals
 * @property {(args: object) => Promise<object>} startProject
 * @property {(userId: number) => Promise<object[]>} getUserProjects
 * @property {(userId: number, projectId: number) => Promise<object>} getUserProject
 * @property {(userId: number, projectId: number, fields: object) => Promise<object>} updateProject
 */

export const PORTS = {
  userRepository: 'userRepository',
  userService: 'userService',
  authService: 'authService',
  projectService: 'projectService',
};
