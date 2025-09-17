import { describe, it, expect, beforeEach } from "vitest";
import { principalCV, stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_AMOUNT = 101;
const ERR_INVALID_PARTNER = 102;
const ERR_INVALID_ACTIVITY = 103;
const ERR_ALREADY_CLAIMED = 104;
const ERR_INVALID_CONTRACT = 105;
const ERR_INVALID_RATE = 106;
const ERR_INVALID_CLAIM_ID = 108;
const ERR_EXPIRED_CLAIM = 109;

interface Claim {
  amount: number;
  timestamp: number;
  partner: string;
  activityType: string;
  status: string;
}

interface Result<T> {
  ok: boolean;
  value: T | number;
}

class EarningVaultMock {
  state: {
    admin: string;
    tokenContract: string | null;
    partnerRegistry: string | null;
    rewardRate: number;
    claimExpiry: number;
    activityClaims: Map<string, Claim>;
    partnerRewards: Map<string, number>;
  } = {
    admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    tokenContract: null,
    partnerRegistry: null,
    rewardRate: 10,
    claimExpiry: 1440,
    activityClaims: new Map(),
    partnerRewards: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

  reset() {
    this.state = {
      admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      tokenContract: null,
      partnerRegistry: null,
      rewardRate: 10,
      claimExpiry: 1440,
      activityClaims: new Map(),
      partnerRewards: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
  }

  setTokenContract(contractPrincipal: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.tokenContract !== null) return { ok: false, value: ERR_INVALID_CONTRACT };
    this.state.tokenContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setPartnerRegistry(contractPrincipal: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.partnerRegistry !== null) return { ok: false, value: ERR_INVALID_CONTRACT };
    this.state.partnerRegistry = contractPrincipal;
    return { ok: true, value: true };
  }

  setRewardRate(rate: number): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (rate <= 0 || rate > 100) return { ok: false, value: ERR_INVALID_RATE };
    this.state.rewardRate = rate;
    return { ok: true, value: true };
  }

  submitActivity(user: string, amount: number, activityType: string, claimId: string): Result<boolean> {
    if (!this.state.partnerRegistry) return { ok: false, value: ERR_INVALID_PARTNER };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (!["ride", "walk", "transit"].includes(activityType)) return { ok: false, value: ERR_INVALID_ACTIVITY };
    if (this.state.activityClaims.has(`${user}:${claimId}`)) return { ok: false, value: ERR_ALREADY_CLAIMED };
    if (!this.state.tokenContract) return { ok: false, value: ERR_INVALID_CONTRACT };
    this.state.activityClaims.set(`${user}:${claimId}`, { amount, timestamp: this.blockHeight, partner: this.caller, activityType, status: "pending" });
    this.state.partnerRewards.set(this.caller, (this.state.partnerRewards.get(this.caller) || 0) + amount);
    return { ok: true, value: true };
  }

  mintReward(user: string, claimId: string): Result<boolean> {
    const claim = this.state.activityClaims.get(`${user}:${claimId}`);
    if (!claim) return { ok: false, value: ERR_INVALID_CLAIM_ID };
    if (claim.status !== "pending") return { ok: false, value: ERR_INVALID_CLAIM_ID };
    if (this.blockHeight - claim.timestamp > this.state.claimExpiry) return { ok: false, value: ERR_EXPIRED_CLAIM };
    if (!this.state.tokenContract) return { ok: false, value: ERR_INVALID_CONTRACT };
    const amount = claim.amount * this.state.rewardRate;
    this.state.activityClaims.set(`${user}:${claimId}`, { ...claim, amount, status: "minted" });
    return { ok: true, value: true };
  }

  getClaimDetails(user: string, claimId: string): Claim | null {
    return this.state.activityClaims.get(`${user}:${claimId}`) || null;
  }

  getPartnerRewards(partner: string): number {
    return this.state.partnerRewards.get(partner) || 0;
  }
}

describe("EarningVault", () => {
  let contract: EarningVaultMock;

  beforeEach(() => {
    contract = new EarningVaultMock();
    contract.reset();
  });

  it("sets token contract successfully", () => {
    const result = contract.setTokenContract("ST2TOKEN");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.tokenContract).toBe("ST2TOKEN");
  });

  it("rejects token contract set by non-admin", () => {
    contract.caller = "ST2USER";
    const result = contract.setTokenContract("ST2TOKEN");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("submits activity successfully", () => {
    contract.setTokenContract("ST2TOKEN");
    contract.setPartnerRegistry("ST3PARTNER");
    contract.caller = "ST4PARTNER";
    const result = contract.submitActivity("ST2USER", 100, "ride", "claim-001");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getClaimDetails("ST2USER", "claim-001")).toEqual({ amount: 100, timestamp: 0, partner: "ST4PARTNER", activityType: "ride", status: "pending" });
    expect(contract.getPartnerRewards("ST4PARTNER")).toBe(100);
  });

  it("mints reward successfully", () => {
    contract.setTokenContract("ST2TOKEN");
    contract.setPartnerRegistry("ST3PARTNER");
    contract.caller = "ST4PARTNER";
    contract.submitActivity("ST2USER", 100, "ride", "claim-001");
    contract.caller = "ST2USER";
    const result = contract.mintReward("ST2USER", "claim-001");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getClaimDetails("ST2USER", "claim-001")?.status).toBe("minted");
    expect(contract.getClaimDetails("ST2USER", "claim-001")?.amount).toBe(1000);
  });

  it("rejects invalid activity type", () => {
    contract.setTokenContract("ST2TOKEN");
    contract.setPartnerRegistry("ST3PARTNER");
    contract.caller = "ST4PARTNER";
    const result = contract.submitActivity("ST2USER", 100, "invalid", "claim-001");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ACTIVITY);
  });

  it("rejects expired claim", () => {
    contract.setTokenContract("ST2TOKEN");
    contract.setPartnerRegistry("ST3PARTNER");
    contract.caller = "ST4PARTNER";
    contract.submitActivity("ST2USER", 100, "ride", "claim-001");
    contract.blockHeight = 1441;
    contract.caller = "ST2USER";
    const result = contract.mintReward("ST2USER", "claim-001");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_EXPIRED_CLAIM);
  });

  it("rejects activity without partner registry", () => {
    contract.setTokenContract("ST2TOKEN");
    contract.caller = "ST4PARTNER";
    const result = contract.submitActivity("ST2USER", 100, "ride", "claim-001");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PARTNER);
  });
});