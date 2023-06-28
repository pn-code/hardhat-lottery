const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle, vrfCoordinatorV2Mock, entranceFee, deployer, interval;
          const chainid = network.config.chainId;

          // Deploy everything
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              raffle = await ethers.getContract("Raffle", deployer);
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployer
              );
              entranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
          });

          describe("constructor", function () {
              it("initializes the raffle correctly", async function () {
                  const raffleState = await raffle.getRaffleState();
                  const interval = await raffle.getInterval();
                  assert.equal(raffleState.toString(), "0");
                  assert.equal(
                      interval.toString(),
                      networkConfig[chainid]["interval"]
                  );
              });
          });

          describe("enterRaffle", function () {
              it("reverts when you don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughETH"
                  );
              });

              it("records players when they enter", async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(playerFromContract, deployer);
              });

              it("emits an event on enter", async function () {
                  await expect(
                      raffle.enterRaffle({ value: entranceFee })
                  ).to.emit(raffle, "RaffleEnter");
              });

              it("doesn't allow entrance when raffle is calculating", async () => {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });
                  // we pretend to be a keeper for a second
                  await raffle.performUpkeep([]); // changes the state to calculating for our comparison below
                  await expect(
                      raffle.enterRaffle({ value: entranceFee })
                  ).to.be.revertedWith(
                      // is reverted as raffle is calculating
                      "Raffle__CannotEnterWhenRaffleIsCalculating"
                  );
              });
          });
          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(
                      []
                  );

                  assert(!upkeepNeeded);
              });
              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep([]);
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(
                      []
                  );
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });
              it("returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() - 5,
                  ]);
                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(
                      []
                  );
                  assert(!upkeepNeeded);
              });
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(
                      []
                  );
                  assert(upkeepNeeded);
              });
          });
      });
