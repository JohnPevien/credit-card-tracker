import { describe, it, expect, vi, beforeEach } from "vitest";
import { PersonService } from "../personService";
import { supabase } from "@/lib/supabase";

// Mock the supabase client
vi.mock("@/lib/supabase", () => ({
    supabase: {
        from: vi.fn(),
    },
}));

describe("PersonService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetAllMocks();
        // Reset the supabase.from mock to a fresh mock function
        (supabase.from as ReturnType<typeof vi.fn>).mockReset();
    });

    describe("loadPersons", () => {
        it("should return persons array", async () => {
            const mockPersons = [
                { id: "person-1", name: "John Doe", slug: "john-doe" },
                { id: "person-2", name: "Jane Doe", slug: "jane-doe" },
            ];

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: mockPersons, error: null }),
            });

            const result = await PersonService.loadPersons();

            expect(result).toEqual(mockPersons);
            expect(supabase.from).toHaveBeenCalledWith("persons");
        });

        it("should return empty array when no data", async () => {
            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: null, error: null }),
            });

            const result = await PersonService.loadPersons();

            expect(result).toEqual([]);
        });

        it("should throw error on failure", async () => {
            const mockError = new Error("Database error");

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: null, error: mockError }),
            });

            await expect(PersonService.loadPersons()).rejects.toThrow("Database error");
        });
    });

    describe("loadPerson", () => {
        it("should return single person by id", async () => {
            const mockPerson = { id: "person-1", name: "John Doe", slug: "john-doe" };

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: mockPerson, error: null }),
                    }),
                }),
            });

            const result = await PersonService.loadPerson("person-1");

            expect(result).toEqual(mockPerson);
        });

        it("should throw error when person not found", async () => {
            const mockError = new Error("Not found");

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
                    }),
                }),
            });

            await expect(PersonService.loadPerson("invalid-id")).rejects.toThrow("Not found");
        });
    });

    describe("loadPersonBySlug", () => {
        it("should return person by slug", async () => {
            const mockPerson = { id: "person-1", name: "John Doe", slug: "john-doe" };

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: mockPerson, error: null }),
                    }),
                }),
            });

            const result = await PersonService.loadPersonBySlug("john-doe");

            expect(result).toEqual(mockPerson);
        });

        it("should throw error when slug not found", async () => {
            const mockError = new Error("Not found");

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
                    }),
                }),
            });

            await expect(PersonService.loadPersonBySlug("invalid-slug")).rejects.toThrow(
                "Not found",
            );
        });
    });

    describe("addPerson", () => {
        it("should create person with generated slug", async () => {
            const mockInsert = vi.fn().mockResolvedValue({ error: null });

            (supabase.from as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                })
                .mockReturnValueOnce({
                    insert: mockInsert,
                });

            await PersonService.addPerson({ name: "John Doe" });

            expect(mockInsert).toHaveBeenCalledWith({
                name: "John Doe",
                slug: "john-doe",
            });
        });

        it("should throw error on insert failure", async () => {
            const mockError = new Error("Insert failed");

            (supabase.from as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                })
                .mockReturnValueOnce({
                    insert: vi.fn().mockResolvedValue({ error: mockError }),
                });

            await expect(PersonService.addPerson({ name: "John Doe" })).rejects.toThrow(
                "Insert failed",
            );
        });
    });

    describe("deletePerson", () => {
        it("should call delete with correct id", async () => {
            const mockEq = vi.fn().mockResolvedValue({ error: null });

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
                delete: vi.fn().mockReturnValue({
                    eq: mockEq,
                }),
            });

            await PersonService.deletePerson("person-1");

            expect(mockEq).toHaveBeenCalledWith("id", "person-1");
        });

        it("should throw error on delete failure", async () => {
            const mockError = new Error("Delete failed");

            (supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
                delete: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: mockError }),
                }),
            });

            await expect(PersonService.deletePerson("person-1")).rejects.toThrow("Delete failed");
        });
    });
});
