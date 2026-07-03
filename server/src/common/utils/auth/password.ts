import argon2 from "argon2"

const ARGON_OPTIONS: argon2.Options & { raw?: false } = {
	type: argon2.argon2id,
	memoryCost: 2 ** 16, // 64 MB
	timeCost: 3,
	parallelism: 1,
}

export async function hashPassword(plainPassword: string): Promise<string> {
	return argon2.hash(plainPassword, ARGON_OPTIONS)
}

export async function verifyPassword(
	hashedPassword: string,
	plainPassword: string,
): Promise<boolean> {
	return argon2.verify(hashedPassword, plainPassword)
}
