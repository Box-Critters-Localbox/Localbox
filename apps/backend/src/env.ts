/*
 * Localbox - A Typescript server emulator for Box Critters
 * Copyright (C) 2024 Index (https://indexx.dev/)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { z } from "zod";

const envSchema = z
	.object({
		ENVIRONMENT: z
			.enum(["production", "development"])
			.optional()
			.default("production"),
		DB_PATH: z.string().default("sqlite.db"),
		JWT_SECRET: z.string().min(1),
	});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(Bun.env);