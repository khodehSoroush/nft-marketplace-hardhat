const { assert, expect } = require("chai");
const { network, deployments, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Nft Marketplace Tests", function () {
      let nftMarketplace, basicNft, deployer, player;
      const PRICE = ethers.utils.parseEther("0.1");
      const TOKEN_ID = 0;
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        // player = (await getNamedAccounts()).player;
        const accounts = await ethers.getSigners();
        // deployer = accounts[0];
        player = accounts[1];
        await deployments.fixture(["all"]);
        nftMarketplace = await ethers.getContract("NftMarketplace");
        basicNft = await ethers.getContract("BasicNft");
        await basicNft.mintNft();
        await basicNft.approve(nftMarketplace.address, TOKEN_ID);
      });
      it("lists and can be bought", async function () {
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        const playerConnectedNftMarketplace = nftMarketplace.connect(player);
        await playerConnectedNftMarketplace.buyItem(
          basicNft.address,
          TOKEN_ID,
          { value: PRICE }
        );
        const newOwner = await basicNft.ownerOf(TOKEN_ID);
        const deployerProceeds = await nftMarketplace.getProceeds(deployer);
        assert(newOwner.toString() == player.address);
        assert(deployerProceeds.toString() == PRICE.toString());
      });
      it("emits an event after listing an item", async function () {
        expect(
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
        ).to.be.emit("ItemListed");
      });
      it("Items that haven't been listed", async function () {
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        const error = `NftMarketplace__AlreadyListed("${basicNft.address}", ${TOKEN_ID})`;
        await expect(
          nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
        ).to.be.revertedWith(error);
      });
      it("Allows owner to list", async function () {
        const playerConnectedNftMarketplace = nftMarketplace.connect(player);
        await basicNft.approve(player.address, TOKEN_ID);
        await expect(
          playerConnectedNftMarketplace.listItem(
            basicNft.address,
            TOKEN_ID,
            PRICE
          )
        ).to.be.revertedWith("NftMarketplace__NotOwner");
      });
      it("Makes sure that price is above zero", async function () {
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        assert.isAbove(PRICE, 0);
      });
      it("Needs approval to list Item", async function () {
        await basicNft.approve(player.address, TOKEN_ID);
        await expect(
          nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
        ).to.be.revertedWith("NftMarketplace__NotApprovedForMarketplace");
      });
      it("revert if there isn't listings", async function () {
        const error = `NftMarketplace__NotListed("${basicNft.address}", ${TOKEN_ID})`;
        await expect(
          nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
        ).to.be.revertedWith(error);
      });
      it("Emits event and remove listing", async function () {
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        expect(
          await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
        ).to.emit("ItemCanceled");
        const listing = await nftMarketplace.getListing(
          basicNft.address,
          TOKEN_ID
        );
        assert(listing.price.toString() == "0");
      });
      it("reverts if the price not met", async function () {
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        await expect(
          nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
        ).to.be.revertedWith("NftMarketplace__PriceNotMet");
      });
      it("updates the price of the item", async function () {
        const updatedPrice = ethers.utils.parseEther("0.2");
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        expect(
          await nftMarketplace.updateListing(
            basicNft.address,
            TOKEN_ID,
            updatedPrice
          )
        ).to.emit("ItemListed");
        const listing = await nftMarketplace.getListing(
          basicNft.address,
          TOKEN_ID
        );
        assert(listing.price.toString() == updatedPrice.toString());
      });
      it("doesn't allow 0 withdrawls", async function () {
        await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(
          "NftMarketplace__NoProceeds"
        );
      });
    });
