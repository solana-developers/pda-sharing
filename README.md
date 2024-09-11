# PDA Sharing

This project demonstrates the vulnerabilities associated with PDA sharing in Solana programs. Example code from the PDA sharing lesson from the Solana Program Security course.

## Prerequisites

- Rust and Cargo
- Solana CLI tools
- Anchor CLI
- Node.js and Yarn

## Setup

1. Clone the repository

```bash
   git clone <repository-url>
   cd <project-directory>
```

2. Install dependencies:

```bash
   yarn install
```

3. Build the Anchor project

```bash
   anchor build
```

4. Sync the program ID:

```bash
  anchor keys sync
```

## Running Tests

```bash
anchor test
```

## Notes

- Ensure your Solana validator is running locally before running tests.
- The test uses the `@solana-developers/helpers` package for airdropping SOL to test accounts.
- If you encounter any issues, make sure your Anchor.toml and Cargo.toml files are correctly configured for your project.
