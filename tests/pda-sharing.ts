import * as anchor from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { PdaSharing } from "../target/types/pda_sharing";
import { Keypair } from "@solana/web3.js";
import { expect, assert } from "chai";
import { PublicKey } from "@solana/web3.js";

describe("pda-sharing", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PdaSharing as Program<PdaSharing>;
  const connection = anchor.getProvider().connection;
  const wallet = anchor.workspace.PdaSharing.provider.wallet;
  const walletFake = Keypair.generate();

  const poolInsecureFake = Keypair.generate();

  const vaultRecommended = Keypair.generate();

  let mint: anchor.web3.PublicKey;
  let vaultInsecure: spl.Account;
  let vaultSecure: spl.Account;
  let withdrawDestination: anchor.web3.PublicKey;
  let withdrawDestinationFake: anchor.web3.PublicKey;

  let authInsecure: anchor.web3.PublicKey;
  let authInsecureBump: number;

  before(async () => {
    mint = await spl.createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      1
    );
    // find PDA
    [authInsecure, authInsecureBump] = PublicKey.findProgramAddressSync(
      [mint.toBuffer()],
      program.programId
    );

    vaultInsecure = await spl.getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      mint,
      authInsecure,
      true
    );

    withdrawDestination = await spl.createAccount(
      connection,
      wallet.payer,
      mint,
      wallet.publicKey
    );

    withdrawDestinationFake = await spl.createAccount(
      connection,
      wallet.payer,
      mint,
      walletFake.publicKey
    );

    const airdropSignature = await provider.connection.requestAirdrop(
      walletFake.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );

    const latestBlockHash = await provider.connection.getLatestBlockhash();

    await provider.connection.confirmTransaction(
      {
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: airdropSignature,
      },
      "confirmed"
    );
  });

  it("Insecure initialize allows pool to be initialized with wrong vault", async () => {
    await program.methods
      .initializePool(authInsecureBump)
      .accounts({
        pool: poolInsecureFake.publicKey,
        mint: mint,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestinationFake,
      })
      .signers([poolInsecureFake])
      .rpc();

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultInsecure.address,
      wallet.payer,
      100
    );

    const account = await spl.getAccount(connection, vaultInsecure.address);
    expect(account.amount).eq(100n);
  });

  it("Insecure withdraw allows withdraw to wrong destination", async () => {
    await program.methods
      .withdrawInsecure()
      .accounts({
        pool: poolInsecureFake.publicKey,
        authority: authInsecure,
      })
      .rpc();

    const account = await spl.getAccount(connection, vaultInsecure.address);

    expect(account.amount).eq(0n);
  });

  it("Secure pool initialization and withdraw works", async () => {
    const withdrawDestinationAccount = await spl.getAccount(
      provider.connection,
      withdrawDestination
    );

    await program.methods
      .initializePoolSecure()
      .accounts({
        mint: mint,
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .signers([vaultRecommended])
      .rpc();

    await new Promise((x) => setTimeout(x, 1000));

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultRecommended.publicKey,
      wallet.payer,
      100
    );

    await program.methods
      .withdrawSecure()
      .accounts({
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .rpc();

    const afterAccount = await spl.getAccount(
      provider.connection,
      withdrawDestination
    );

    expect(afterAccount.amount - withdrawDestinationAccount.amount).eq(100n);
  });

  it("Secure withdraw doesn't allow withdraw to wrong destination", async () => {
    try {
      await program.methods
        .withdrawSecure()
        .accounts({
          vault: vaultRecommended.publicKey,
          withdrawDestination: withdrawDestinationFake,
        })
        .signers([vaultRecommended])
        .rpc();

      assert.fail("expected error");
    } catch (error) {
      console.log(error.message);
      expect(error);
    }
  });

  it("Secure pool initialization doesn't allow wrong vault", async () => {
    try {
      await program.methods
        .initializePoolSecure()
        .accounts({
          mint: mint,
          vault: vaultInsecure.address,
          withdrawDestination: withdrawDestination,
        })
        .signers([vaultRecommended])
        .rpc();

      assert.fail("expected error");
    } catch (error) {
      console.log(error.message);
      expect(error);
    }
  });
});
