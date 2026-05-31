import { AsyncLocalStorage } from 'async_hooks';

// Stores { schoolId } for the duration of each HTTP request.
// Populated by the protect middleware; read by the tenantPlugin below.
export const tenantStore = new AsyncLocalStorage();

/**
 * Global Mongoose plugin — auto-injects { schoolId } into every query on
 * tenant-scoped models (i.e. schemas that declare a schoolId path).
 *
 * Safe in all edge cases:
 *  - Superadmin: user.schoolId is undefined → store.schoolId is null → no injection
 *  - Background jobs / tests: no tenantStore.run() active → getStore() is undefined → no injection
 *  - Controller already set schoolId: respected as-is (not overridden)
 */
export function tenantPlugin(schema) {
  if (!schema.path('schoolId')) return; // not a tenant-scoped model — skip

  const injectFilter = function () {
    const ctx = tenantStore.getStore();
    if (!ctx?.schoolId) return;
    if (!this.getFilter().schoolId) {
      this.where({ schoolId: ctx.schoolId });
    }
  };

  const hooks = [
    'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete',
    'countDocuments', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
  ];
  for (const hook of hooks) {
    schema.pre(hook, injectFilter);
  }
}
