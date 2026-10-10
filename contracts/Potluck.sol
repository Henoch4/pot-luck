// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Potluck is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable fund;

    struct Circle {
        address creator;
        uint256 contribution;
        uint256 rounds;
        address payable[] members;
        uint256 currentRound;
        uint256 paidCount;
        uint256 totalPaid;
        bool active;
    }

    Circle[] public circles;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) private paidLedger;

    event CircleCreated(uint256 indexed circleId, address indexed creator, uint256 contribution, uint256 rounds, uint256 memberCount);
    event Contributed(uint256 indexed circleId, address indexed member, uint256 round, uint256 amount);
    event Payout(uint256 indexed circleId, address indexed receiver, uint256 round, uint256 amount);

    constructor(address _fund) {
        fund = IERC20(_fund);
    }

    function createCircle(uint256 contribution, uint256 rounds, address payable[] memory memberList) external nonReentrant {
        require(contribution > 0, "Contribution must be > 0");
        require(rounds > 0, "Rounds must be > 0");
        require(memberList.length >= 2, "Need >= 2 members");
        bool containsSender = false;
        for (uint256 i = 0; i < memberList.length; i++) {
            require(memberList[i] != address(0), "Zero member");
            if (memberList[i] == payable(msg.sender)) containsSender = true;
        }
        require(containsSender, "Creator must be a member");

        uint256 id = circles.length;
        Circle storage c = circles.push();
        c.creator = msg.sender;
        c.contribution = contribution;
        c.rounds = rounds;
        c.members = memberList;
        c.active = true;
        emit CircleCreated(id, msg.sender, contribution, rounds, memberList.length);
    }

    function contribute(uint256 circleId) external nonReentrant {
        Circle storage c = circles[circleId];
        require(c.active, "Circle not active");
        require(c.currentRound < c.rounds, "Circle complete");
        bool member = false;
        for (uint256 i = 0; i < c.members.length; i++) {
            if (c.members[i] == payable(msg.sender)) { member = true; break; }
        }
        require(member, "Not a member");
        require(!paidLedger[circleId][c.currentRound][msg.sender], "Already paid this round");

        paidLedger[circleId][c.currentRound][msg.sender] = true;
        fund.safeTransferFrom(msg.sender, address(this), c.contribution);
        c.paidCount += 1;
        c.totalPaid += c.contribution;
        emit Contributed(circleId, msg.sender, c.currentRound, c.contribution);

        if (c.paidCount == c.members.length) {
            uint256 finishedRound = c.currentRound;
            address payable receiver = c.members[finishedRound % c.members.length];
            uint256 pot = c.contribution * c.members.length;
            c.currentRound += 1;
            c.paidCount = 0;
            fund.safeTransfer(receiver, pot);
            emit Payout(circleId, receiver, finishedRound, pot);
            if (c.currentRound == c.rounds) c.active = false;
        }
    }

    function hasPaid(uint256 circleId, address member) external view returns (bool) {
        return paidLedger[circleId][circles[circleId].currentRound][member];
    }

    function getCircle(uint256 circleId)
        external
        view
        returns (address, uint256, uint256, uint256, uint256, uint256, bool, address payable[] memory)
    {
        Circle storage c = circles[circleId];
        return (c.creator, c.contribution, c.rounds, c.currentRound, c.paidCount, c.totalPaid, c.active, c.members);
    }
}
