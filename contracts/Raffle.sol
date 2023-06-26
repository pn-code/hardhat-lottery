// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

// Errors
error Raffle__NotEnoughETH();

contract Raffle {
    // State Variables
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;

    constructor(uint256 entranceFee) {
        i_entranceFee = entranceFee;
    }

    // Functions
    function enterRaffle() public payable {
        // If the payment is not enough, revert with error.
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETH();
        }

        s_players.push(payable(msg.sender));
    }

    // Getters
    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }
}
