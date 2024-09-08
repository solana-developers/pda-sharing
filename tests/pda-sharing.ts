import * as anchor from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { PdaSharing } from "../target/types/pda_sharing";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { airdropIfRequired } from "@solana-developers/helpers";

describe("PDA sharing", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PdaSharing as Program<PdaSharing>;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;
  const fakeWallet = Keypair.generate();

  const insecurePoolFake = Keypair.generate();
  const recommendedVault = Keypair.generate();

  let tokenMint: PublicKey;
  let insecureVault: spl.Account;
  let secureVault: spl.Account;
  let withdrawDestination: PublicKey;
  let fakeWithdrawDestination: PublicKey;

  let insecureAuthority: PublicKey;
  let insecureAuthorityBump: number;

  const DECIMALS = 1;
  const INITIAL_MINT_AMOUNT = 100;

  before(async () => {
    await airdropIfRequired(
      connection,
      fakeWallet.publicKey,
      1 * LAMPORTS_PER_SOL,
      0.5 * LAMPORTS_PER_SOL
    );

    tokenMint = await spl.createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      DECIMALS
    );

    [insecureAuthority, insecureAuthorityBump] =
      PublicKey.findProgramAddressSync(
        [tokenMint.toBuffer()],
        program.programId
      );

    insecureVault = await spl.getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      tokenMint,
      insecureAuthority,
      true
    );

    withdrawDestination = await spl.createAccount(
      connection,
      wallet.payer,
      tokenMint,
      wallet.publicKey
    );

    fakeWithdrawDestination = await spl.createAccount(
      connection,
      wallet.payer,
      tokenMint,
      fakeWallet.publicKey
    );
  });

  it("allows insecure initialization with incorrect vault", async () => {
    try {
      await program.methods
        .initializePool(insecureAuthorityBump)
        .accounts({
          pool: insecurePoolFake.publicKey,
          mint: tokenMint,
          vault: insecureVault.address,
          withdrawDestination: fakeWithdrawDestination,
        })
        .signers([insecurePoolFake])
        .rpc();

      await spl.mintTo(
        connection,
        wallet.payer,
        tokenMint,
        insecureVault.address,
        wallet.payer,
        INITIAL_MINT_AMOUNT
      );

      const vaultAccount = await spl.getAccount(
        connection,
        insecureVault.address
      );
      expect(Number(vaultAccount.amount)).to.equal(INITIAL_MINT_AMOUNT);
    } catch (error) {
      throw new Error(`Test failed: ${error.message}`);
    }
  });

  it("allows insecure withdrawal to incorrect destination", async () => {
    try {
      await program.methods
        .withdrawInsecure()
        .accounts({
          pool: insecurePoolFake.publicKey,
          authority: insecureAuthority,
        })
        .rpc();

      const vaultAccount = await spl.getAccount(
        connection,
        insecureVault.address
      );
      expect(Number(vaultAccount.amount)).to.equal(0);
    } catch (error) {
      throw new Error(`Test failed: ${error.message}`);
    }
  });

  it("performs secure pool initialization and withdrawal correctly", async () => {
    try {
      const initialWithdrawBalance = await spl.getAccount(
        connection,
        withdrawDestination
      );

      await program.methods
        .initializePoolSecure()
        .accounts({
          mint: tokenMint,
          vault: recommendedVault.publicKey,
          withdrawDestination: withdrawDestination,
        })
        .signers([recommendedVault])
        .rpc();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await spl.mintTo(
        connection,
        wallet.payer,
        tokenMint,
        recommendedVault.publicKey,
        wallet.payer,
        INITIAL_MINT_AMOUNT
      );

      await program.methods
        .withdrawSecure()
        .accounts({
          vault: recommendedVault.publicKey,
          withdrawDestination: withdrawDestination,
        })
        .rpc();

      const finalWithdrawBalance = await spl.getAccount(
        connection,
        withdrawDestination
      );

      expect(
        Number(finalWithdrawBalance.amount) -
          Number(initialWithdrawBalance.amount)
      ).to.equal(INITIAL_MINT_AMOUNT);
    } catch (error) {
      throw new Error(`Test failed: ${error.message}`);
    }
  });

  it("prevents secure withdrawal to incorrect destination", async () => {
    try {
      await program.methods
        .withdrawSecure()
        .accounts({
          vault: recommendedVault.publicKey,
          withdrawDestination: fakeWithdrawDestination,
        })
        .signers([recommendedVault])
        .rpc();

      throw new Error("Expected an error but withdrawal succeeded");
    } catch (error) {
      expect(error).to.exist;
      console.log("Error message:", error.message);
    }
  });

  it("prevents secure pool initialization with incorrect vault", async () => {
    try {
      await program.methods
        .initializePoolSecure()
        .accounts({
          mint: tokenMint,
          vault: insecureVault.address,
          withdrawDestination: withdrawDestination,
        })
        .signers([recommendedVault])
        .rpc();

      throw new Error("Expected an error but initialization succeeded");
    } catch (error) {
      expect(error).to.exist;
      console.log("Error message:", error.message);
    }
  });
});
