import * as anchor from "@project-serum/anchor"
import * as spl from "@solana/spl-token"
import { Program } from "@project-serum/anchor"
import { PdaSharing } from "../target/types/pda_sharing"
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey"
import { Keypair } from "@solana/web3.js"
import { expect } from "chai"

describe("pda-sharing", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.PdaSharing as Program<PdaSharing>
  const connection = anchor.getProvider().connection
  const wallet = anchor.workspace.PdaSharing.provider.wallet
  const walletFake = Keypair.generate()

  const poolInsecure = Keypair.generate()
  const poolInsecureFake = Keypair.generate()

  const poolSecureFake = Keypair.generate()

  const vaultRecommended = Keypair.generate()

  let mint: anchor.web3.PublicKey
  let vaultInsecure: spl.Account
  let vaultSecure: spl.Account
  let withdrawDestination: anchor.web3.PublicKey
  let withdrawDestinationFake: anchor.web3.PublicKey

  let authInsecure: anchor.web3.PublicKey
  let authInsecureBump: number

  let authSecure: anchor.web3.PublicKey
  let authSecureBump: number

  before(async () => {
    mint = await spl.createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      1
    )
    ;[authInsecure, authInsecureBump] = findProgramAddressSync(
      [mint.toBuffer()],
      program.programId
    )

    vaultInsecure = await spl.getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      mint,
      authInsecure,
      true
    )

    withdrawDestination = await spl.createAccount(
      connection,
      wallet.payer,
      mint,
      wallet.publicKey
    )

    withdrawDestinationFake = await spl.createAccount(
      connection,
      wallet.payer,
      mint,
      walletFake.publicKey
    )

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        walletFake.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    )
    ;[authSecure, authSecureBump] = findProgramAddressSync(
      [withdrawDestination.toBuffer()],
      program.programId
    )

    vaultSecure = await spl.getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      mint,
      authSecure,
      true
    )
  })

  it("Initialize Pool Insecure", async () => {
    await program.methods
      .initializePool(authInsecureBump)
      .accounts({
        pool: poolInsecure.publicKey,
        mint: mint,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestination,
      })
      .signers([poolInsecure])
      .rpc()

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultInsecure.address,
      wallet.payer,
      100
    )

    const account = await spl.getAccount(connection, vaultInsecure.address)
    console.log(account.amount)
  })

  it("Withdraw", async () => {
    await program.methods
      .withdrawInsecure()
      .accounts({
        pool: poolInsecure.publicKey,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestination,
        authority: authInsecure,
      })
      .rpc()

    const account = await spl.getAccount(connection, vaultInsecure.address)
    console.log(account.amount)
  })

  it("Initialize Fake Pool Insecure", async () => {
    const tx = await program.methods
      .initializePool(authInsecureBump)
      .accounts({
        pool: poolInsecureFake.publicKey,
        mint: mint,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestinationFake,
        payer: walletFake.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      walletFake,
      poolInsecureFake,
    ])

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultInsecure.address,
      wallet.payer,
      100
    )

    const account = await spl.getAccount(connection, vaultInsecure.address)
    console.log(account.amount)
  })

  it("WithdrawFake", async () => {
    const tx = await program.methods
      .withdrawInsecure()
      .accounts({
        pool: poolInsecureFake.publicKey,
        vault: vaultInsecure.address,
        withdrawDestination: withdrawDestinationFake,
        authority: authInsecure,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      walletFake,
    ])

    const account = await spl.getAccount(connection, vaultInsecure.address)
    console.log(account.amount)
  })

  it("Initialize Fake Pool Secure", async () => {
    await program.methods
      .initializePool(authSecureBump)
      .accounts({
        pool: poolSecureFake.publicKey,
        mint: mint,
        vault: vaultSecure.address,
        withdrawDestination: withdrawDestinationFake,
      })
      .signers([poolSecureFake])
      .rpc()

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultSecure.address,
      wallet.payer,
      100
    )

    const account = await spl.getAccount(connection, vaultSecure.address)
    console.log(account.amount)
  })

  it("Initialize Pool Recommended", async () => {
    await program.methods
      .initializePoolRecommended()
      .accounts({
        pool: authSecure,
        mint: mint,
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .signers([vaultRecommended])
      .rpc()

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultRecommended.publicKey,
      wallet.payer,
      100
    )

    const account = await spl.getAccount(connection, vaultRecommended.publicKey)
    console.log(account.amount)
  })

  it("Withdraw", async () => {
    await program.methods
      .withdrawRecommended()
      .accounts({
        pool: authSecure,
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .rpc()

    const account = await spl.getAccount(connection, vaultRecommended.publicKey)
    console.log(account.amount)
  })
})
