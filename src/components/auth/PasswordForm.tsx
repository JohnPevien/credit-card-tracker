"use client";

import React from "react";

interface PasswordFormProps {
    password: string;
    onPasswordChange: (value: string) => void;
    loading: boolean;
    onSubmit: (e: React.FormEvent) => void;
}

export default function PasswordForm({
    password,
    onPasswordChange,
    loading,
    onSubmit,
}: PasswordFormProps) {
    return (
        <form onSubmit={onSubmit} data-component="PasswordForm">
            <div className="form-control">
                <label className="label" htmlFor="password">
                    <span className="label-text">Password</span>
                </label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    className="input input-bordered w-full"
                    placeholder="Enter site password"
                    required
                    autoFocus
                />
            </div>

            <div className="form-control mt-6">
                <button
                    type="submit"
                    className={`btn btn-primary ${loading ? "loading" : ""}`}
                    disabled={loading}
                >
                    {loading ? "Authenticating..." : "Access Site"}
                </button>
            </div>
        </form>
    );
}
