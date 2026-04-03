// @ts-check

class ProfileService {
  /** @returns {Record<string, any> | null} */
  static get() {
    const email = SupabaseClient.getCurrentUserEmail_();
    const res = /** @type {any[] | null} */ (SupabaseClient.request_('get', `user_profiles?email=eq.${encodeURIComponent(email)}`));
    return res && res.length > 0 ? res[0] : null;
  }

  /**
   * @param {string} displayName
   * @param {number} [capacity=40]
   * @returns {Record<string, any> | null}
   */
  static create(displayName, capacity = 40) {
    const email = SupabaseClient.getCurrentUserEmail_();
    const payload = { email, display_name: displayName, weekly_capacity_hours: capacity };
    const res = /** @type {any[] | null} */ (SupabaseClient.request_('post', 'user_profiles', payload));
    return res ? res[0] : null;
  }

  /**
   * @param {Partial<{display_name: string, weekly_capacity_hours: number}>} data
   * @returns {Record<string, any> | null}
   */
  static update(data) {
    const email = SupabaseClient.getCurrentUserEmail_();
    const res = /** @type {any[] | null} */ (SupabaseClient.request_('patch', `user_profiles?email=eq.${encodeURIComponent(email)}`, data));
    return res ? res[0] : null;
  }

  /** @returns {boolean} */
  static delete() {
    const email = SupabaseClient.getCurrentUserEmail_();
    SupabaseClient.request_('delete', `user_profiles?email=eq.${encodeURIComponent(email)}`);
    return true;
  }
}