const { ethers } = require("hardhat");

const networkConfig = {
    4: {
        name: "sepolia",
        vrfCoordinatorV2: "0x447fd5ec2d383091c22b8549cb231a3bad6d3faf",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane:
            "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        subscriptionId: "0",
        callbackGasLimit: "500000", //500,000
        interval: 30,
    },
    31337: {
        name: "hardhat",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane:
            "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        callbackGasLimit: "500000", //500,000
        interval: 30,
    },
};

const developmentChains = ["hardhat", "localhost"];

module.exports = { networkConfig, developmentChains };
