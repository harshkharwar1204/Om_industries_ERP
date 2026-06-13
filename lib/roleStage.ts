// Maps a worker role to the production stage they're responsible for closing.
export const ROLE_STAGE: Record<string, 'hanks' | 'dyeing' | 'coning'> = {
  hanks_worker: 'hanks',
  coning_worker: 'coning',
  dyeing_master: 'dyeing',
};
