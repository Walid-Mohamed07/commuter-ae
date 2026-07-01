import { connectDB } from "@/lib/db/mongoose";
import { Wallet } from "@/models/Wallet";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Types } from "mongoose";

/** Ensure a wallet doc exists for the user and return it. */
export async function getOrCreateWallet(userId: string) {
  await connectDB();
  const uid = new Types.ObjectId(userId);
  let wallet = await Wallet.findOne({ userId: uid });
  if (!wallet) {
    wallet = await Wallet.create({ userId: uid, balanceEgp: 0 });
  }
  return wallet;
}

/**
 * Credit funds to a wallet atomically and write a completed ledger entry.
 * Used when a top-up is confirmed paid.
 */
export async function creditWallet(
  userId: string,
  amountEgp: number,
  opts: {
    description: string;
    transactionId?: string;
    type?: "topup" | "refund";
  } = {
    description: "Wallet top-up",
  },
): Promise<number> {
  await connectDB();
  const uid = new Types.ObjectId(userId);

  const wallet = await Wallet.findOneAndUpdate(
    { userId: uid },
    {
      $inc: { balanceEgp: amountEgp, totalCreditedEgp: amountEgp },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true, upsert: true },
  );

  if (opts.transactionId) {
    // Mark the existing pending top-up ledger row as completed.
    await WalletTransaction.findByIdAndUpdate(opts.transactionId, {
      status: "completed",
      balanceAfterEgp: wallet.balanceEgp,
    });
  } else {
    await WalletTransaction.create({
      userId: uid,
      type: opts.type ?? "topup",
      amountEgp,
      status: "completed",
      description: opts.description,
      balanceAfterEgp: wallet.balanceEgp,
    });
  }

  return wallet.balanceEgp;
}

/**
 * Debit funds from a wallet atomically. The conditional filter
 * (`balanceEgp >= amount`) makes the deduction race-safe without a transaction:
 * if two requests race, only one matches and decrements. Returns the new
 * balance, or null when the balance is insufficient (no change made).
 */
export async function debitWallet(
  userId: string,
  amountEgp: number,
  opts: { description: string; bookingId?: string },
): Promise<number | null> {
  await connectDB();
  const uid = new Types.ObjectId(userId);

  const wallet = await Wallet.findOneAndUpdate(
    { userId: uid, status: "active", balanceEgp: { $gte: amountEgp } },
    {
      $inc: { balanceEgp: -amountEgp, totalDebitedEgp: amountEgp },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true },
  );

  if (!wallet) return null;

  await WalletTransaction.create({
    userId: uid,
    type: "payment",
    amountEgp,
    status: "completed",
    description: opts.description,
    balanceAfterEgp: wallet.balanceEgp,
    bookingId: opts.bookingId ? new Types.ObjectId(opts.bookingId) : undefined,
  });

  return wallet.balanceEgp;
}
