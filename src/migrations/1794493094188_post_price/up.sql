-- A nullable whole-number price in roubles. NULL means "price not set": the public card shows nothing.
ALTER TABLE "posts" ADD COLUMN "price" integer;
