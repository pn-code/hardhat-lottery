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

          describe("performUpkeep", function () {
              it("can only run if checkUpkeep is true", async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const tx = await raffle.performUpkeep([]);
                  assert(tx);
              });
              it("reverts when checkUpkeep is false", async function () {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded"
                  );
              });
              it("updates the raffle state, emits event, and calls vrfCoordinator", async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const txResponse = await raffle.performUpkeep([]);
                  const txReceipt = await txResponse.wait(1);
                  const requestId = txReceipt.events[1].args.requestId;
                  const raffleState = await raffle.getRaffleState();
                  assert(requestId.toNumber() > 0);
                  assert(raffleState.toString() == "1");
              });
          });
          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
              });
              it("can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith("nonexistent request");
              });
              it("picks a winner, resets lottery, and sends money", async function () {
                  const additionalEntrants = 3;
                  const startingAccountIndex = 2;
                  const accounts = await ethers.getSigners();

                  for (
                      let i = startingAccountIndex;
                      i < additionalEntrants + startingAccountIndex;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(
                          accounts[i]
                      );
                      await accountConnectedRaffle.enterRaffle({
                          value: entranceFee,
                      });
                  }

                  const startingTimeStamp = await raffle.getLastTimeStamp();

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("Found the event!");
                          try {
                              const recentWinner =
                                  await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp =
                                  await raffle.getLastTimeStamp();
                              const numPlayers =
                                  await raffle.getNumberOfPlayers();
                              const winnerEndingBalance =
                                  await accounts[2].getBalance();
                              await expect(raffle.getPlayer(0)).to.be.reverted;

                              assert.equal(
                                  recentWinner.toString(),
                                  accounts[2].address
                              );
                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(raffleState.toString(), "0");
                              assert(endingTimeStamp > startingTimeStamp);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance
                                      .add(
                                          entranceFee
                                              .mul(additionalEntrants)
                                              .add(entranceFee)
                                      )
                                      .toString()
                              );
                          } catch (error) {
                              reject(error);
                          }
                          resolve();
                      });
                      const tx = await raffle.performUpkeep([]);
                      const txReceipt = await tx.wait(1);

                      const winnerStartingBalance =
                          await accounts[2].getBalance();

                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          raffle.address
                      );
                  });
              });
          });
      });
