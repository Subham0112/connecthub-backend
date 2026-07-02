-- CreateTable
CREATE TABLE "friends" (
    "friends_id" SERIAL NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "receiver_id" INTEGER NOT NULL,
    "friend_status" TEXT DEFAULT 'pending',
    "requested_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(6),

    CONSTRAINT "friends_pkey" PRIMARY KEY ("friends_id")
);

-- AddForeignKey
ALTER TABLE "friends" ADD CONSTRAINT "friends_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friends" ADD CONSTRAINT "friends_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
