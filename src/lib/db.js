import { request } from './http.js';
import { getSession, getToken } from './session.js';

/** Row Level Security protected table access, as the signed-in host. */
export async function db(path, { prefer = 'return=representation', ...opts } = {}) {
  return request('/rest/v1/' + path, { ...opts, token: await getToken(), headers: { Prefer: prefer } });
}
/** Calls a locked server function. Guests use this for get_invite and submit_rsvp. */
export const rpc = (fn, args) => request('/rest/v1/rpc/' + fn, { method: 'POST', body: args, token: getSession() && getSession().access_token });
