import type { Request, Response, NextFunction } from "express"

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		res.status(501).json({ error: "Not implemented" })
	} catch (err) { next(err) }
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		res.status(501).json({ error: "Not implemented" })
	} catch (err) { next(err) }
}

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		res.status(501).json({ error: "Not implemented" })
	} catch (err) { next(err) }
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		res.status(501).json({ error: "Not implemented" })
	} catch (err) { next(err) }
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	try {
		res.status(501).json({ error: "Not implemented" })
	} catch (err) { next(err) }
}
