import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumberish, ContractRunner } from "ethers";
import hre from "hardhat";
import { Contract } from "hardhat/internal/hardhat-network/stack-traces/model";

describe("LinearVesting", function () {
  async function deploy() {
    // deploy the token
    const Token = await hre.ethers.getContractFactory("Token");
    const token = await Token.deploy(
      "OnMyChain",
      "OMC",
      hre.ethers.parseEther("10000")
    );

    const recipients = (await hre.ethers.getSigners()).map((s) => s.address);
    const signers = await hre.ethers.getSigners();
    console.log(recipients);
    const allocations = recipients.map((r, idx) =>
      hre.ethers.parseEther((idx * 10).toString())
    );

    const startTime = (await time.latest()) + 60; // starts 60 seconds after deployment
    const duration = 60 * 60;

    // deploy the contract
    const Contract = await hre.ethers.getContractFactory("LinearVesting");
    const contract = await Contract.deploy(
      await token.getAddress(),
      recipients,
      allocations,
      startTime,
      duration
    );

    return {
      contract,
      token,
      recipients,
      allocations,
      startTime,
      duration,
      signers,
    };
  }

  describe("deployment", function () {
    it("should have a token", async function () {
      const { contract, token } = await loadFixture(deploy);
      expect(await contract.token()).to.eq(await token.getAddress());
    });

    it("should have a start time", async function () {
      const { contract, startTime } = await loadFixture(deploy);
      expect(await contract.startTime()).to.eq(startTime);
    });

    it("should have a duration", async function () {
      const { contract, duration } = await loadFixture(deploy);
      expect(await contract.duration()).to.eq(duration);
    });
  });

  describe("claim", function () {
    it("should revert before start time", async function () {
      const { contract, signers } = await loadFixture(deploy);
      for await (const signer of signers) {
        await expect(contract.connect(signer).claim()).to.be.revertedWith(
          "LinearVesting: has not started"
        );
      }
    });

    it("should transfer available tokens", async function () {
      const { contract, token, signers, allocations, startTime, duration } =
        await loadFixture(deploy);
      await time.increaseTo(startTime);
      await time.increase(duration / 2 - 1); // increase to 50% of tokens being available

      const allocation = allocations[0];
      const amount = allocation / 2n;
      await expect(contract.connect(signers[0]).claim()).to.changeTokenBalances(
        token,
        [contract, signers[0]],
        [amount * -1n, amount]
      );
    });

    it("should update claimed", async function () {
      const { contract, token, signers, allocations, startTime, duration } =
        await loadFixture(deploy);
      await time.increaseTo(startTime);
      await time.increase(duration / 2 - 1); // increase to 50% of tokens being available

      const allocation = allocations[0];
      const amount = allocation / 2n;
      expect(await contract.claimed(signers[0].address)).to.eq(0);
      await contract.connect(signers[0]).claim();
      expect(await contract.claimed(signers[0].address)).to.eq(amount);
    });
  });

});
