import type { Request, Response, NextFunction } from "express"

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		// TODO: implement
		res.status(501).json({ error: "Not implemented" })
	} catch (err) {
		next(err)
	}
}

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		res.status(501).json({ error: "Not implemented" })
	} catch (err) {
		next(err)
	}
}

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		res.status(501).json({ error: "Not implemented" })
	} catch (err) {
		next(err)
	}
}

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		res.status(501).json({ error: "Not implemented" })
	} catch (err) {
		next(err)
	}
}

export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		res.status(501).json({ error: "Not implemented" })
	} catch (err) {
		next(err)
	}
}
