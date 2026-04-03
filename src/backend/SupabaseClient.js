// @ts-check

/**
 * SupabaseClient.js
 * Core engine for database communication. Private to the server environment.
 */

class SupabaseClient {
  /**
   * @returns {string} The active user's email address.
   */
  static getCurrentUserEmail_() {
    return Session.getActiveUser().getEmail().toLowerCase();
  }

  /**
   * @returns {Record<string, string>} HTTP headers for Supabase.
   */
  static getHeaders_() {
    const props = PropertiesService.getScriptProperties();
    const serviceKey = props.getProperty('SUPABASE_SERVICE_KEY');
    const anonKey = props.getProperty('SUPABASE_ANON_KEY'); 
    if (!serviceKey || !anonKey) throw new Error("Missing Supabase keys.");

    return {
      "apikey": anonKey,
      "Authorization": "Bearer " + serviceKey,
      "Content-Type": "application/json",
      "Prefer": "return=representation" 
    };
  }

  /**
   * Universal request handler.
   * @param {'get'|'post'|'patch'|'delete'} method 
   * @param {string} endpoint 
   * @param {Record<string, any> | null} [payload=null] 
   * @returns {any[] | Record<string, any> | null}
   */
  static request_(method, endpoint, payload = null) {
    const props = PropertiesService.getScriptProperties();
    const baseUrl = props.getProperty('SUPABASE_URL');
    if (!baseUrl) throw new Error("Missing SUPABASE_URL.");

    /** @type {GoogleAppsScript.URL_Fetch.URLFetchRequestOptions} */
    const options = {
      method: method,
      headers: this.getHeaders_(),
      muteHttpExceptions: true 
    };
    if (payload) options.payload = JSON.stringify(payload);

    const response = UrlFetchApp.fetch(`${baseUrl}/rest/v1/${endpoint}`, options);
    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code >= 200 && code < 300) return text ? JSON.parse(text) : null;
    throw new Error(`DB Error (${code}): ${text}`);
  }

  /**
   * Security Gatekeeper: Verifies user is in the requested Organization.
   * @param {string} email 
   * @param {string} orgId 
   * @returns {boolean}
   */
  static verifyOrgAccess_(email, orgId) {
    const check = /** @type {any[] | null} */ (this.request_('get', `organization_members?user_email=eq.${encodeURIComponent(email)}&organization_id=eq.${orgId}`));
    return (check && check.length > 0) || false;
  }
}