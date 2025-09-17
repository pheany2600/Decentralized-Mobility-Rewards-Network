(define-constant ERR_NOT_AUTHORIZED u100)
(define-constant ERR_INVALID_AMOUNT u101)
(define-constant ERR_INVALID_PARTNER u102)
(define-constant ERR_INVALID_ACTIVITY u103)
(define-constant ERR_ALREADY_CLAIMED u104)
(define-constant ERR_INVALID_CONTRACT u105)
(define-constant ERR_INVALID_RATE u106)
(define-constant ERR_INVALID_TIMESTAMP u107)
(define-constant ERR_INVALID_CLAIM_ID u108)
(define-constant ERR_EXPIRED_CLAIM u109)

(define-data-var admin principal tx-sender)
(define-data-var token-contract (optional principal) none)
(define-data-var partner-registry (optional principal) none)
(define-data-var reward-rate uint u10)
(define-data-var claim-expiry uint u1440)

(define-map activity-claims { user: principal, claim-id: (string-ascii 64) } { amount: uint, timestamp: uint, partner: principal, activity-type: (string-ascii 50), status: (string-ascii 20) })
(define-map partner-rewards principal uint)

(define-private (validate-amount (amount uint))
  (if (> amount u0) true false))

(define-private (validate-activity-type (activity-type (string-ascii 50)))
  (if (or (is-eq activity-type "ride") (is-eq activity-type "walk") (is-eq activity-type "transit")) true false))

(define-private (validate-partner (partner principal))
  (if (is-some (var-get partner-registry)) true false))

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height) true false))

(define-private (validate-admin)
  (is-eq tx-sender (var-get admin)))

(define-private (validate-claim (user principal) (claim-id (string-ascii 64)))
  (is-some (map-get? activity-claims { user: user, claim-id: claim-id })))

(define-public (set-token-contract (contract-principal principal))
  (begin
    (asserts! (validate-admin) (err ERR_NOT_AUTHORIZED))
    (asserts! (is-none (var-get token-contract)) (err ERR_INVALID_CONTRACT))
    (var-set token-contract (some contract-principal))
    (ok true)))

(define-public (set-partner-registry (contract-principal principal))
  (begin
    (asserts! (validate-admin) (err ERR_NOT_AUTHORIZED))
    (asserts! (is-none (var-get partner-registry)) (err ERR_INVALID_CONTRACT))
    (var-set partner-registry (some contract-principal))
    (ok true)))

(define-public (set-reward-rate (rate uint))
  (begin
    (asserts! (validate-admin) (err ERR_NOT_AUTHORIZED))
    (asserts! (and (> rate u0) (<= rate u100)) (err ERR_INVALID_RATE))
    (var-set reward-rate rate)
    (ok true)))

(define-public (set-claim-expiry (expiry uint))
  (begin
    (asserts! (validate-admin) (err ERR_NOT_AUTHORIZED))
    (asserts! (> expiry u0) (err ERR_INVALID_AMOUNT))
    (var-set claim-expiry expiry)
    (ok true)))

(define-public (submit-activity (user principal) (amount uint) (activity-type (string-ascii 50)) (claim-id (string-ascii 64)))
  (begin
    (asserts! (validate-partner tx-sender) (err ERR_INVALID_PARTNER))
    (asserts! (validate-amount amount) (err ERR_INVALID_AMOUNT))
    (asserts! (validate-activity-type activity-type) (err ERR_INVALID_ACTIVITY))
    (asserts! (not (validate-claim user claim-id)) (err ERR_ALREADY_CLAIMED))
    (asserts! (is-some (var-get token-contract)) (err ERR_INVALID_CONTRACT))
    (map-set activity-claims { user: user, claim-id: claim-id } { amount: amount, timestamp: block-height, partner: tx-sender, activity-type: activity-type, status: "pending" })
    (map-set partner-rewards tx-sender (+ (default-to u0 (map-get? partner-rewards tx-sender)) amount))
    (ok true)))

(define-public (mint-reward (user principal) (claim-id (string-ascii 64)))
  (let ((claim (unwrap! (map-get? activity-claims { user: user, claim-id: claim-id }) (err ERR_INVALID_CLAIM_ID))))
    (asserts! (is-eq (get status claim) "pending") (err ERR_INVALID_CLAIM_ID))
    (asserts! (<= (- block-height (get timestamp claim)) (var-get claim-expiry)) (err ERR_EXPIRED_CLAIM))
    (asserts! (is-some (var-get token-contract)) (err ERR_INVALID_CONTRACT))
    (let ((amount (* (get amount claim) (var-get reward-rate))))
      (map-set activity-claims { user: user, claim-id: claim-id } { amount: amount, timestamp: (get timestamp claim), partner: (get partner claim), activity-type: (get activity-type claim), status: "minted" })
      (ok true))))

(define-read-only (get-claim-details (user principal) (claim-id (string-ascii 64)))
  (map-get? activity-claims { user: user, claim-id: claim-id }))

(define-read-only (get-partner-rewards (partner principal))
  (default-to u0 (map-get? partner-rewards partner)))