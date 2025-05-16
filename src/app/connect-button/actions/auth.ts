"use server";
import { cookies } from "next/headers";
import {
	type GenerateLoginPayloadParams,
	type VerifyLoginPayloadParams,
	createAuth,
} from "thirdweb/auth";
import { privateKeyToAccount } from "thirdweb/wallets";
import { client } from "../../../lib/client";
import { getUserByWallet, saveUser, deleteUserProfile } from "../../../lib/supabase";

const privateKey = process.env.THIRDWEB_ADMIN_PRIVATE_KEY || "";

// Provide a fallback secret key at build time so thirdweb/auth doesn't throw.
if (!process.env.THIRDWEB_SECRET_KEY) {
	process.env.THIRDWEB_SECRET_KEY = "placeholder_secret_key";
}
const secretKeyEnv = process.env.THIRDWEB_SECRET_KEY;

if (!privateKey) {
	throw new Error("Missing THIRDWEB_ADMIN_PRIVATE_KEY in .env file.");
}

const thirdwebAuth = createAuth({
	domain: process.env.NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN || "",
	adminAccount: privateKeyToAccount({ client, privateKey }),
	client,
});

export async function generatePayload(payload: GenerateLoginPayloadParams) {
	return thirdwebAuth.generatePayload(payload);
}

export async function login(payload: VerifyLoginPayloadParams) {
	const verifiedPayload = await thirdwebAuth.verifyPayload(payload);
	console.log(verifiedPayload);
	if (verifiedPayload.valid) {
		const jwt = await thirdwebAuth.generateJWT({
			payload: verifiedPayload.payload,
		});
		const c = await cookies();
		c.set("jwt", jwt);
		
		// Save user info
		const walletAddress = verifiedPayload.payload.address;
		if (walletAddress) {
			// Check if user already exists
			const existingUser = await getUserByWallet(walletAddress);
			if (!existingUser) {
				// Create new user with default display name (abbreviated wallet address)
				await saveUser({
					wallet_address: walletAddress,
					display_name: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
					created_at: new Date().toISOString()
				});
			}
		}
	}
}

export async function isLoggedIn() {
	const c = await cookies();
	const jwt = c.get("jwt");
	console.log(jwt);
	if (!jwt?.value) {
		return false;
	}

	const authResult = await thirdwebAuth.verifyJWT({ jwt: jwt.value });
	if (!authResult.valid) {
		return false;
	}
	return true;
}

export async function logout() {
	const c = await cookies();
	c.delete("jwt");
}

// Function to get current authenticated wallet address
export async function getCurrentAddress(): Promise<string | null> {
	const c = await cookies();
	const jwt = c.get("jwt");
	if (!jwt?.value) {
		return null;
	}

	const authResult = await thirdwebAuth.verifyJWT({ jwt: jwt.value });
	if (!authResult.valid) {
		return null;
	}
	
	// Access the address from the parsed JWT
	// @ts-ignore - address exists in the JWT payload but TypeScript doesn't know about it
	const address = authResult.parsedJWT.address || authResult.parsedJWT.sub;
	return address;
}

// Function to update user display name
export async function updateUserDisplayName(displayName: string): Promise<boolean> {
	try {
		const address = await getCurrentAddress();
		if (!address) return false;
		
		console.log(`Updating display name for ${address} to: ${displayName}`);
		
		// Get the existing user or create a new one
		const existingUser = await getUserByWallet(address);
		if (existingUser) {
			await saveUser({
				...existingUser,
				display_name: displayName
			});
		} else {
			await saveUser({
				wallet_address: address,
				display_name: displayName,
				created_at: new Date().toISOString()
			});
		}
		console.log("Display name updated successfully");
		return true;
	} catch (e) {
		console.error("Failed to update display name:", e);
		// Return false to indicate failure
		return false;
	}
}

// Function to delete user profile
export async function deleteUserDisplayName(): Promise<boolean> {
	try {
		const address = await getCurrentAddress();
		if (!address) return false;
		
		console.log(`Deleting profile for ${address}`);
		
		// Delete the user profile
		const deleted = await deleteUserProfile(address);
		
		if (deleted) {
			console.log("Profile deleted successfully");
			// Create a new profile with default name
			await saveUser({
				wallet_address: address,
				display_name: `${address.slice(0, 6)}...${address.slice(-4)}`,
				created_at: new Date().toISOString()
			});
			return true;
		} else {
			console.error("Failed to delete profile");
			return false;
		}
	} catch (e) {
		console.error("Error deleting profile:", e);
		return false;
	}
}
