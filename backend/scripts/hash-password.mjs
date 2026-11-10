import bcrypt from "bcryptjs";

const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error('Usage: npm run hash-password -- "at-least-10-characters"');
  process.exit(1);
}
console.log(await bcrypt.hash(pw, 12));
