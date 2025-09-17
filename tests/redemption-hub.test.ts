import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV, principalCV } from "@stacks/transactions";

const ERR_INSUFFICIENT_BALANCE = 100;
const ERR_INVALID_REWARD = 102;
const ERR_ALREADY_REDEEMED = 104;
const ERR_INVALID_AMOUNT = 105;
const ERR_NOT_AUTHORIZED = 106;
const ERR_PARTNER_NOT_ACTIVE = 109;

interface Redemption {
  amount: number;
  timestamp: number;
  status: string;
  partner: string;
}

interface Partner {
  active: boolean;
  rewardRate: number;
  apiKeyHash: Uint8Array;
}

interface Result<T> {
  ok: boolean;
  value: T | number; // Allow number for error codes
}

class RedemptionHubMock {
  state: {
    redemptionFee: number;
    admin: string;
    partnerContract: string | null;
    tokenContract: string | null;
    escrowContract: string | null;
    redemptions: Map<string, Redemption>;
    userBalances: Map<string, number>;
    partners: Map<string, Partner>;
  } = {
    redemptionFee: 100,
    admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    partnerContract: null,
    tokenContract: null,
    escrowContract: null,
    redemptions: new Map(),
    userBalances: new Map(),
    partners: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];
  tokenTransfers: Array<{ amount: number; from: string; to: string }> = [];

  reset() {
    this.state = {
      redemptionFee: 100,
      admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      partnerContract: null,
      tokenContract: null,
      escrowContract: null,
      redemptions: new Map(),
      userBalances: new Map(),
      partners: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    this.stxTransfers = [];
    this.tokenTransfers = [];
  }

  setPartnerContract(contract: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.partnerContract = contract;
    return { ok: true, value: true };
  }

  setTokenContract(contract: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.tokenContract = contract;
    return { ok: true, value: true };
  }

  setEscrowContract(contract: string): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.escrowContract = contract;
    return { ok: true, value: true };
  }

  setRedemptionFee(fee: number): Result<boolean> {
    if (this.caller !== this.state.admin) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.redemptionFee = fee;
    return { ok: true, value: true };
  }

  registerPartner(partner: string, rewardRate: number, apiKeyHash: Uint8Array): Result<boolean> {
    if (!this.state.partnerContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.partners.set(partner, { active: true, rewardRate, apiKeyHash });
    return { ok: true, value: true };
  }

  redeemTokens(amount: number, partner: string, rewardId: string): Result<boolean> {
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    const partnerData = this.state.partners.get(partner);
    if (!partnerData || !partnerData.active) return { ok: false, value: ERR_PARTNER_NOT_ACTIVE };
    if (!rewardId) return { ok: false, value: ERR_INVALID_REWARD };
    const balance = this.state.userBalances.get(this.caller) || 0;
    if (balance < amount) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    if (this.state.redemptions.has(`${this.caller}:${rewardId}`)) return { ok: false, value: ERR_ALREADY_REDEEMED };
    if (!this.state.tokenContract || !this.state.escrowContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.tokenTransfers.push({ amount, from: this.caller, to: this.state.escrowContract });
    this.state.redemptions.set(`${this.caller}:${rewardId}`, { amount, timestamp: this.blockHeight, status: "pending", partner });
    this.stxTransfers.push({ amount: this.state.redemptionFee, from: this.caller, to: this.state.admin });
    return { ok: true, value: true };
  }

  confirmRedemption(user: string, rewardId: string): Result<boolean> {
    const redemption = this.state.redemptions.get(`${user}:${rewardId}`);
    if (!redemption) return { ok: false, value: ERR_INVALID_REWARD };
    if (this.caller !== redemption.partner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (redemption.status !== "pending") return { ok: false, value: ERR_INVALID_REWARD };
    if (!this.state.escrowContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.redemptions.set(`${user}:${rewardId}`, { ...redemption, status: "confirmed" });
    this.state.userBalances.set(user, (this.state.userBalances.get(user) || 0) - redemption.amount);
    return { ok: true, value: true };
  }

  cancelRedemption(user: string, rewardId: string): Result<boolean> {
    const redemption = this.state.redemptions.get(`${user}:${rewardId}`);
    if (!redemption) return { ok: false, value: ERR_INVALID_REWARD };
    if (this.caller !== user && this.caller !== redemption.partner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (redemption.status !== "pending") return { ok: false, value: ERR_INVALID_REWARD };
    if (!this.state.escrowContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.redemptions.set(`${user}:${rewardId}`, { ...redemption, status: "cancelled" });
    return { ok: true, value: true };
  }

  getRedemptionFee(): Result<number> {
    return { ok: true, value: this.state.redemptionFee };
  }

  getUserBalance(user: string): number {
    return this.state.userBalances.get(user) || 0;
  }
}

describe("RedemptionHub", () => {
  let contract: RedemptionHubMock;

  beforeEach(() => {
    contract = new RedemptionHubMock();
    contract.reset();
  });

  it("sets partner contract successfully", () => {
    const result = contract.setPartnerContract("ST2PARTNER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.partnerContract).toBe("ST2PARTNER");
  });

  it("rejects partner contract set by non-admin", () => {
    contract.caller = "ST2USER";
    const result = contract.setPartnerContract("ST2PARTNER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("registers partner successfully", () => {
    contract.setPartnerContract("ST2PARTNER");
    const apiKeyHash = new Uint8Array(32).fill(1);
    const result = contract.registerPartner("ST3PARTNER", 10, apiKeyHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.partners.get("ST3PARTNER")).toEqual({ active: true, rewardRate: 10, apiKeyHash });
  });

  it("rejects partner registration without partner contract", () => {
    const apiKeyHash = new Uint8Array(32).fill(1);
    const result = contract.registerPartner("ST3PARTNER", 10, apiKeyHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("redeems tokens successfully", () => {
    contract.setPartnerContract("ST2PARTNER");
    contract.setTokenContract("ST3TOKEN");
    contract.setEscrowContract("ST4ESCROW");
    contract.state.userBalances.set("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 1000);
    contract.registerPartner("ST5PARTNER", 10, new Uint8Array(32).fill(1));
    const result = contract.redeemTokens(500, "ST5PARTNER", "reward-001");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.redemptions.get("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM:reward-001")).toEqual({
      amount: 500,
      timestamp: 0,
      status: "pending",
      partner: "ST5PARTNER",
    });
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", to: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" }]);
    expect(contract.tokenTransfers).toEqual([{ amount: 500, from: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", to: "ST4ESCROW" }]);
  });

  it("rejects redemption with insufficient balance", () => {
    contract.setPartnerContract("ST2PARTNER");
    contract.setTokenContract("ST3TOKEN");
    contract.setEscrowContract("ST4ESCROW");
    contract.state.userBalances.set("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 100);
    contract.registerPartner("ST5PARTNER", 10, new Uint8Array(32).fill(1));
    const result = contract.redeemTokens(500, "ST5PARTNER", "reward-001");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_BALANCE);
  });

  it("confirms redemption successfully", () => {
    contract.setPartnerContract("ST2PARTNER");
    contract.setTokenContract("ST3TOKEN");
    contract.setEscrowContract("ST4ESCROW");
    contract.state.userBalances.set("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 1000);
    contract.registerPartner("ST5PARTNER", 10, new Uint8Array(32).fill(1));
    contract.redeemTokens(500, "ST5PARTNER", "reward-001");
    contract.caller = "ST5PARTNER";
    const result = contract.confirmRedemption("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "reward-001");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.redemptions.get("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM:reward-001")?.status).toBe("confirmed");
    expect(contract.getUserBalance("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")).toBe(500);
  });

  it("cancels redemption successfully", () => {
    contract.setPartnerContract("ST2PARTNER");
    contract.setTokenContract("ST3TOKEN");
    contract.setEscrowContract("ST4ESCROW");
    contract.state.userBalances.set("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 1000);
    contract.registerPartner("ST5PARTNER", 10, new Uint8Array(32).fill(1));
    contract.redeemTokens(500, "ST5PARTNER", "reward-001");
    contract.caller = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    const result = contract.cancelRedemption("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "reward-001");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.redemptions.get("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM:reward-001")?.status).toBe("cancelled");
  });

  it("rejects redemption with invalid partner", () => {
    contract.setPartnerContract("ST2PARTNER");
    contract.setTokenContract("ST3TOKEN");
    contract.setEscrowContract("ST4ESCROW");
    contract.state.userBalances.set("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 1000);
    const result = contract.redeemTokens(500, "ST5PARTNER", "reward-001");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PARTNER_NOT_ACTIVE);
  });

  it("parses Clarity types correctly", () => {
    const rewardId = stringAsciiCV("reward-001");
    const amount = uintCV(500);
    const principal = principalCV("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM");
    expect(rewardId.value).toBe("reward-001");
    expect(amount.value).toEqual(BigInt(500));
    expect(principal.value).toBe("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM");
  });
});