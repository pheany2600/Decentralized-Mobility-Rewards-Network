(define-constant ERR_INSUFFICIENT_BALANCE u100)
(define-constant ERR_INVALID_PARTNER u101)
(define-constant ERR_INVALID_REWARD u102)
(define-constant ERR_ESCROW_FAILED u103)
(define-constant ERR_ALREADY_REDEEMED u104)
(define-constant ERR_INVALID_AMOUNT u105)
(define-constant ERR_NOT_AUTHORIZED u106)
(define-constant ERR_INVALID_TIMESTAMP u107)
(define-constant ERR_TOKEN_TRANSFER_FAILED u108)
(define-constant ERR_PARTNER_NOT_ACTIVE u109)

(define-data-var redemption-fee uint u100)
(define-data-var admin principal tx-sender)
(define-data-var partner-contract (optional principal) none)
(define-data-var token-contract (optional principal) none)
(define-data-var escrow-contract (optional principal) none)

(define-map redemptions
  { user: principal, reward-id: (string-ascii 64) }
  { amount: uint, timestamp: uint, status: (string-ascii 20), partner: principal })

(define-map user-balances
  principal
  uint)

(define-map partners
  principal
  { active: bool, reward-rate: uint, api-key-hash: (buff 32) })

(define-read-only (get-redemption (user principal) (reward-id (string-ascii 64)))
  (map-get? redemptions { user: user, reward-id: reward-id }))

(define-read-only (get-user-balance (user principal))
  (default-to u0 (map-get? user-balances user)))

(define-read-only (get-partner (partner principal))
  (map-get? partners partner))

(define-private (validate-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR_INVALID_AMOUNT)))

(define-private (validate-partner (partner principal))
  (match (map-get? partners partner)
    p (if (get active p) (ok true) (err ERR_PARTNER_NOT_ACTIVE))
    (err ERR_INVALID_PARTNER)))

(define-private (validate-reward-id (reward-id (string-ascii 64)))
  (if (> (len reward-id) u0)
      (ok true)
      (err ERR_INVALID_REWARD)))

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR_INVALID_TIMESTAMP)))

(define-public (set-partner-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_NOT_AUTHORIZED))
    (var-set partner-contract (some contract))
    (ok true)))

(define-public (set-token-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_NOT_AUTHORIZED))
    (var-set token-contract (some contract))
    (ok true)))

(define-public (set-escrow-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_NOT_AUTHORIZED))
    (var-set escrow-contract (some contract))
    (ok true)))

(define-public (set-redemption-fee (fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err ERR_NOT_AUTHORIZED))
    (var-set redemption-fee fee)
    (ok true)))

(define-public (register-partner (partner principal) (reward-rate uint) (api-key-hash (buff 32)))
  (begin
    (asserts! (is-some (var-get partner-contract)) (err ERR_NOT_AUTHORIZED))
    (map-set partners partner { active: true, reward-rate: reward-rate, api-key-hash: api-key-hash })
    (ok true)))

(define-public (redeem-tokens (amount uint) (partner principal) (reward-id (string-ascii 64)))
  (let (
      (user tx-sender)
      (balance (get-user-balance user))
      (token-addr (unwrap! (var-get token-contract) (err ERR_NOT_AUTHORIZED)))
      (escrow-addr (unwrap! (var-get escrow-contract) (err ERR_NOT_AUTHORIZED)))
    )
    (try! (validate-amount amount))
    (try! (validate-partner partner))
    (try! (validate-reward-id reward-id))
    (asserts! (>= balance amount) (err ERR_INSUFFICIENT_BALANCE))
    (asserts! (is-none (map-get? redemptions { user: user, reward-id: reward-id })) (err ERR_ALREADY_REDEEMED))
    (try! (contract-call? token-addr transfer amount user escrow-addr none))
    (map-set redemptions
      { user: user, reward-id: reward-id }
      { amount: amount, timestamp: block-height, status: "pending", partner: partner })
    (try! (stx-transfer? (var-get redemption-fee) user (var-get admin)))
    (print { event: "redemption-initiated", user: user, reward-id: reward-id, amount: amount })
    (ok true)))

(define-public (confirm-redemption (user principal) (reward-id (string-ascii 64)))
  (let (
      (redemption (unwrap! (map-get? redemptions { user: user, reward-id: reward-id }) (err ERR_INVALID_REWARD)))
      (escrow-addr (unwrap! (var-get escrow-contract) (err ERR_NOT_AUTHORIZED)))
    )
    (asserts! (is-eq tx-sender (get partner redemption)) (err ERR_NOT_AUTHORIZED))
    (asserts! (is-eq (get status redemption) "pending") (err ERR_INVALID_STATUS))
    (map-set redemptions
      { user: user, reward-id: reward-id }
      (merge redemption { status: "confirmed" }))
    (try! (contract-call? escrow-addr release (get amount redemption) user tx-sender))
    (map-set user-balances user (- (get-user-balance user) (get amount redemption)))
    (print { event: "redemption-confirmed", user: user, reward-id: reward-id })
    (ok true)))

(define-public (cancel-redemption (user principal) (reward-id (string-ascii 64)))
  (let (
      (redemption (unwrap! (map-get? redemptions { user: user, reward-id: reward-id }) (err ERR_INVALID_REWARD)))
      (escrow-addr (unwrap! (var-get escrow-contract) (err ERR_NOT_AUTHORIZED)))
    )
    (asserts! (or (is-eq tx-sender user) (is-eq tx-sender (get partner redemption))) (err ERR_NOT_AUTHORIZED))
    (asserts! (is-eq (get status redemption) "pending") (err ERR_INVALID_STATUS))
    (map-set redemptions
      { user: user, reward-id: reward-id }
      (merge redemption { status: "cancelled" }))
    (try! (contract-call? escrow-addr refund (get amount redemption) user))
    (print { event: "redemption-cancelled", user: user, reward-id: reward-id })
    (ok true)))

(define-read-only (get-redemption-fee)
  (ok (var-get redemption-fee)))