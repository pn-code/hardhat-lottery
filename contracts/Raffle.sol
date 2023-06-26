// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract Raffle {
    // Errors
    error Raffle__NotEnoughETH();

    // Variables
    uint256 private s_entranceFee;
    address[] private s_players;

    constructor(uint256 entranceFee) {
        s_entranceFee = entranceFee;
    }

    // Functions
    function enterRaffle() public payable {
        // If the payment is not enough, revert with error.
        if (msg.value < s_entranceFee) {
            revert Raffle__NotEnoughETH();
        }

        s_players.push(msg.sender);
    }

    // Getters
    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }
}
