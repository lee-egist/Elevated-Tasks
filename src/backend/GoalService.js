// @ts-check

class GoalService {
  /**
   * @param {string} orgId 
   * @param {string} [projectId] - Optional: Filter by project
   * @returns {any[] | null}
   */
  static list(orgId, projectId = "") {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    
    let endpoint = `goals?organization_id=eq.${orgId}`;
    if (projectId) endpoint += `&project_id=eq.${projectId}`;
    return /** @type {any[] | null} */ (SupabaseClient.request_('get', endpoint));
  }

  /**
   * @param {string} orgId 
   * @param {string} projectId 
   * @param {Record<string, any>} data 
   */
  static create(orgId, projectId, data) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");

    const payload = { ...data, organization_id: orgId, project_id: projectId };
    const res = /** @type {any[] | null} */ (SupabaseClient.request_('post', 'goals', payload));
    return res ? res[0] : null;
  }

  /**
   * @param {string} orgId 
   * @param {string} goalId 
   * @param {Record<string, any>} data 
   */
  static update(orgId, goalId, data) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    const res = /** @type {any[] | null} */ (SupabaseClient.request_('patch', `goals?id=eq.${goalId}`, data));
    return res ? res[0] : null;
  }

  /**
   * @param {string} orgId 
   * @param {string} goalId 
   */
  static delete(orgId, goalId) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    SupabaseClient.request_('delete', `goals?id=eq.${goalId}`);
    return true;
  }
}