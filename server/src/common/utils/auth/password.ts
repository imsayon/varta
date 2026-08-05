import argon2 from "argon2"

export async function hashPassword(plainPassword: string): Promise<string> {
	return argon2.hash(plainPassword, {
		type: argon2.argon2id,
		memoryCost: 2 ** 16, // 64 MB
		timeCost: 3,
		parallelism: 1,
	})
}

export async function verifyPassword(
	hashedPassword: string,
	plainPassword: string,
): Promise<boolean> {
	return argon2.verify(hashedPassword, plainPassword)
}
