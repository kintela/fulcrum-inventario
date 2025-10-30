"use client";

type VerifyResponse = {
  ok?: boolean;
  error?: string;
};

export async function verifyAdminPassword(
  password: string,
): Promise<void> {
  const trimmed = password.trim();
  if (!trimmed) throw new Error("Introduce la contraseña.");

  const response = await fetch("/api/admin-local/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: trimmed }),
  });

  if (!response.ok) {
    let message = "Contraseña incorrecta.";
    try {
      const data = (await response.json()) as VerifyResponse;
      if (typeof data.error === "string" && data.error.trim().length > 0) {
        message = data.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}
