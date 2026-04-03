// @ts-check

class OrganizationService {
  /** @returns {any[] | null} */
  static listMyOrgs() {
    const email = SupabaseClient.getCurrentUserEmail_();
    return /** @type {any[] | null} */ (SupabaseClient.request_('get', `organization_members?user_email=eq.${encodeURIComponent(email)}&select=organizations(id,name,created_at)`));
  }

  /**
   * @param {string} name 
   * @returns {Record<string, any> | null}
   */
  static create(name) {
    const email = SupabaseClient.getCurrentUserEmail_();
    
    // 1. Create the Org
    const orgRes = /** @type {any[] | null} */ (SupabaseClient.request_('post', 'organizations', { name }));
    if (!orgRes || orgRes.length === 0) throw new Error("Failed to create org.");
    const orgId = orgRes[0].id;

    // 2. Add creator as Admin
    SupabaseClient.request_('post', 'organization_members', {
      organization_id: orgId,
      user_email: email,
      org_role: 'admin'
    });

    return orgRes[0];
  }

  /**
   * @param {string} orgId 
   * @param {Partial<{name: string, slug: string}>} data 
   */
  static update(orgId, data) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    const res = /** @type {any[] | null} */ (SupabaseClient.request_('patch', `organizations?id=eq.${orgId}`, data));
    return res ? res[0] : null;
  }

  /** @param {string} orgId */
  static delete(orgId) {
    const email = SupabaseClient.getCurrentUserEmail_();
    if (!SupabaseClient.verifyOrgAccess_(email, orgId)) throw new Error("Unauthorized");
    // Cascades to all projects, tasks, and goals in SQL
    SupabaseClient.request_('delete', `organizations?id=eq.${orgId}`);
    return true;
  }
}