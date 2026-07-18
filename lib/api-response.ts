import { NextResponse } from "next/server";

export const okJson = <T>(data: T) => NextResponse.json(data);

export const errorJson = (message: string, status = 400, details?: unknown) => {
  return NextResponse.json({ error: message, details }, { status });
};

export const readJsonBody = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("请求体不是有效 JSON");
  }
};
