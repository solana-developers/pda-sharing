use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("U5GLbTve227P9GsU7YybT86S13xNRuzGD2PmyvfcX4j");

const DISCRIMINATOR_SIZE: usize = 8;

#[program]
pub mod pda_sharing {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>, bump: u8) -> Result<()> {
        ctx.accounts.pool.vault = ctx.accounts.vault.key();
        ctx.accounts.pool.mint = ctx.accounts.mint.key();
        ctx.accounts.pool.withdraw_destination = ctx.accounts.withdraw_destination.key();
        ctx.accounts.pool.bump = bump;

        Ok(())
    }

    pub fn initialize_pool_secure(ctx: Context<InitializePoolSecure>) -> Result<()> {
        ctx.accounts.pool.vault = ctx.accounts.vault.key();
        ctx.accounts.pool.mint = ctx.accounts.mint.key();
        ctx.accounts.pool.withdraw_destination = ctx.accounts.withdraw_destination.key();
        ctx.accounts.pool.bump = ctx.bumps.pool;
        Ok(())
    }

    pub fn withdraw_insecure(ctx: Context<WithdrawTokens>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[ctx.accounts.pool.mint.as_ref(), &[ctx.accounts.pool.bump]];
        token::transfer(
            get_transfer_ctx(&ctx.accounts).with_signer(&[seeds]),
            amount,
        )
    }

    pub fn withdraw_secure(ctx: Context<WithdrawTokensSecure>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[
            ctx.accounts.pool.withdraw_destination.as_ref(),
            &[ctx.accounts.pool.bump],
        ];
        token::transfer(
            get_secure_transfer_ctx(&ctx.accounts).with_signer(&[seeds]),
            amount,
        )
    }
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = payer,
        space = DISCRIMINATOR_SIZE + TokenPool::INIT_SPACE,
    )]
    pub pool: Account<'info, TokenPool>,
    pub mint: Account<'info, Mint>,
    pub vault: Account<'info, TokenAccount>,
    pub withdraw_destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePoolSecure<'info> {
    #[account(
        init,
        payer = payer,
        space = DISCRIMINATOR_SIZE + TokenPool::INIT_SPACE,
        seeds = [withdraw_destination.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, TokenPool>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = pool,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub withdraw_destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(has_one = vault, has_one = withdraw_destination)]
    pub pool: Account<'info, TokenPool>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    /// CHECK: This account will not be checked by anchor
    pub authority: UncheckedAccount<'info>,
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawTokensSecure<'info> {
    #[account(
        has_one = vault,
        has_one = withdraw_destination,
        seeds = [withdraw_destination.key().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, TokenPool>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn get_transfer_ctx<'accounts, 'remaining, 'cpi_code, 'info>(
    accounts: &'accounts WithdrawTokens<'info>,
) -> CpiContext<'accounts, 'remaining, 'cpi_code, 'info, token::Transfer<'info>> {
    CpiContext::new(
        accounts.token_program.to_account_info(),
        token::Transfer {
            from: accounts.vault.to_account_info(),
            to: accounts.withdraw_destination.to_account_info(),
            authority: accounts.authority.to_account_info(),
        },
    )
}

pub fn get_secure_transfer_ctx<'accounts, 'remaining, 'cpi_code, 'info>(
    accounts: &'accounts WithdrawTokensSecure<'info>,
) -> CpiContext<'accounts, 'remaining, 'cpi_code, 'info, token::Transfer<'info>> {
    CpiContext::new(
        accounts.token_program.to_account_info(),
        token::Transfer {
            from: accounts.vault.to_account_info(),
            to: accounts.withdraw_destination.to_account_info(),
            authority: accounts.pool.to_account_info(),
        },
    )
}

#[account]
#[derive(InitSpace)]
pub struct TokenPool {
    pub vault: Pubkey,
    pub mint: Pubkey,
    pub withdraw_destination: Pubkey,
    pub bump: u8,
}
