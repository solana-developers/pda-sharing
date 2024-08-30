import * as anchor from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { PdaSharing } from "../target/types/pda_sharing";
import { Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";
import { PublicKey } from "@solana/web3.js";

describe("pda-sharing", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PdaSharing as Program<PdaSharing>;
  const connection = anchor.getProvider().connection;
  const wallet = anchor.workspace.PdaSharing.provider.wallet;
  const walletFake = Keypair.generate();

  const poolInsecure = Keypair.generate();
  const poolInsecureFake = Keypair.generate();

  const poolSecureFake = Keypair.generate();

  const vaultRecommended = Keypair.generate();

  let mint: anchor.web3.PublicKey;
  let vaultInsecure: spl.Account;
  let vaultSecure: spl.Account;
  let withdrawDestination: anchor.web3.PublicKey;
  let withdrawDestinationFake: anchor.web3.PublicKey;

  let authInsecure: anchor.web3.PublicKey;
  let authInsecureBump: number;

  let authSecure: anchor.web3.PublicKey;
  let authSecureBump: number;

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

    [authSecure, authSecureBump] = PublicKey.findProgramAddressSync(
      [withdrawDestination.toBuffer()],
      program.programId
    );

    vaultSecure = await spl.getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      mint,
      authSecure,
      true
    );
  });

  it("Insecure initialize allows pool to be initialized with wrong vault", async () => {
    await program.methods
      .initializePool(authInsecureBump)
      .accounts({
        pool: poolInsecure.publicKey,
        mint: mint,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestination,
      })
      .signers([poolInsecure])
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

  it("Insecure withdraw allows stealing from vault", async () => {
    await program.methods
      .withdrawInsecure()
      .accounts({
        pool: poolInsecure.publicKey,
        //authority: authInsecure,
      })
      .rpc();

    const account = await spl.getAccount(connection, vaultInsecure.address);

    expect(account.amount).eq(0n);
  });
});
