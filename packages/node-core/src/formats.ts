/**
 * Signing message formats — the exact strings signed on each side of the
 * wire. All signatures are ed25519 for did:key subjects or EIP-191 for
 * EOA subjects; coordinators also sign dispatches (EIP-191) so nodes can
 * verify authenticity against /pubkey.
 *
 * These are wire constants: changing a format breaks every deployed peer.
 */

/** REGISTER binding — node signs this to prove DID key custody. */
export const bindMessage = (volunteerId: string): string => `chimera-bind:${volunteerId}`

/** JOB_DISPATCH authenticity — coordinator signs; nodes verify against
 *  the address published at GET /pubkey. */
export const dispatchMessage = (jobId: string): string => `chimera-job:${jobId}`

/** JOB_RESULT proof — node signs sha256(result) so results are
 *  attributable and non-repudiable. */
export const resultMessage = (jobId: string, resultHashHex: string): string =>
  `chimera-result:${jobId}:${resultHashHex}`

/** Committee ballot — voter signs to produce the portable SignedBallot. */
export const voteMessage = (motionId: string, phase: 'prevote' | 'precommit', approve: boolean): string =>
  `chimera-vote:${motionId}:${phase}:${approve ? 'yes' : 'no'}`

/** /challenge — challenger binds their counter-evidence hash to the job. */
export const challengeMessage = (jobId: string, counterHash: string): string =>
  `chimera-challenge:${jobId}:${counterHash}`
