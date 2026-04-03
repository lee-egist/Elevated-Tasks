// @ts-check

class ProjectService {
  /**
   * @param {string} orgId 
   * @returns {any[] | null}
   */
  static list(orgId) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    return /** @type {any[] | null} */ (SupabaseClient.request_('get', `projects?organization_id=eq.${orgId}&order=created_at.desc`));
  }

  /**
   * @param {string} orgId 
   * @param {Record<string, any>} data 
   */
  static create(orgId, data) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    
    const payload = { ...data, organization_id: orgId, owner_email: email };
    const res = /** @type {any[] | null} */ (SupabaseClient.request_('post', 'projects', payload));
    return res ? res[0] : null;
  }

  /**
   * @param {string} orgId 
   * @param {string} projectId 
   * @param {Record<string, any>} data 
   */
  static update(orgId, projectId, data) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    const res = /** @type {any[] | null} */ (SupabaseClient.request_('patch', `projects?id=eq.${projectId}&organization_id=eq.${orgId}`, data));
    return res ? res[0] : null;
  }

  /**
   * @param {string} orgId 
   * @param {string} projectId 
   */
  static delete(orgId, projectId) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    SupabaseClient.request_('delete', `projects?id=eq.${projectId}&organization_id=eq.${orgId}`);
    return true;
  }
}