// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { VRFConsumerBaseV2 } from "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import { VRFCoordinatorV2Interface } from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import { AutomationCompatibleInterface } from "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

// Errors
error Raffle__NotEnoughETH();
error NewTransferFailed();
error Raffle__CannotEnterWhenRaffleIsCalculating();
error Raffle__UpkeepIsNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState,
    uint256 timeTillNextWinner
);

/**
 * @title A sample Raffle Contract
 * @author Patrick Collins
 * @notice This contract is for creating an untamperable decentralized smart contract
 * @dev This implements Chainlink VRF v2 & Automation
 */

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    // Type Declarations
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    // State Variables
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    // Lottery Variables
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    // Events
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address winner);

    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    // Functions
    function enterRaffle() public payable {
        // If the payment is not enough, revert with error.
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETH();
        }

        // If lottery is calculating, revert with error
        if (s_raffleState == RaffleState.CALCULATING) {
            revert Raffle__CannotEnterWhenRaffleIsCalculating();
        }

        // When we update an array or mapping, always make sure to emit an event
        s_players.push(payable(msg.sender));
        // Good naming convention for events: function reversed
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that Chainlink Automation nodes call to see if it's time to perform an upkeep
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool isOpen = s_raffleState == RaffleState.OPEN;
        bool timePassed = (block.timestamp - s_lastTimeStamp) > i_interval;
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;

        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    // Requesting random number with Chainlink VRF
    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepIsNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(RaffleState.CALCULATING),
                (i_interval - (block.timestamp - s_lastTimeStamp))
            );
        }

        s_raffleState = RaffleState.CALCULATING;

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );

        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] memory randomWords
    ) internal override {
        // Use modulo calculation to determine the winner from Chainlink VRF
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;

        // Change Raffle state & reset players array & timestamp
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;

        // Send the money
        (bool success, ) = recentWinner.call{ value: address(this).balance }(
            ""
        );
        if (!success) {
            revert NewTransferFailed();
        }

        emit WinnerPicked(recentWinner);
    }

    // Getters
    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
