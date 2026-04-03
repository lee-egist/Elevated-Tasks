// @ts-check

class TaskService {
  /**
   * @param {string} orgId 
   * @param {string} projectId 
   * @returns {any[] | null}
   */
  static listByProject(orgId, projectId) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    return /** @type {any[] | null} */ (SupabaseClient.request_('get', `tasks?project_id=eq.${projectId}&order=created_at.desc`));
  }

  /**
   * @param {string} orgId 
   * @param {string} projectId 
   * @param {Record<string, any>} data 
   */
  static create(orgId, projectId, data) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    
    const payload = { ...data, project_id: projectId, owner: email };
    const res = /** @type {any[] | null} */ (SupabaseClient.request_('post', 'tasks', payload));
    return res ? res[0] : null;
  }

  /**
   * @param {string} orgId 
   * @param {string} taskId 
   * @param {Record<string, any>} data 
   */
  static update(orgId, taskId, data) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    const res = /** @type {any[] | null} */ (SupabaseClient.request_('patch', `tasks?id=eq.${taskId}`, data));
    return res ? res[0] : null;
  }

  /**
   * @param {string} orgId 
   * @param {string} taskId 
   */
  static delete(orgId, taskId) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    SupabaseClient.request_('delete', `tasks?id=eq.${taskId}`);
    return true;
  }
}