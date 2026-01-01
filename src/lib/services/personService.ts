import { supabase, Person } from "@/lib/supabase";

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

async function getUniqueSlug(
    baseSlug: string,
    excludeId?: string,
): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
        let query = supabase.from("persons").select("id").eq("slug", slug);

        if (excludeId) {
            query = query.neq("id", excludeId);
        }

        const { data } = await query;

        if (!data || data.length === 0) {
            return slug;
        }

        slug = `${baseSlug}-${counter}`;
        counter++;
    }
}

export class PersonService {
    static async loadPersons(): Promise<Person[]> {
        try {
            const { data, error } = await supabase.from("persons").select("*");

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Error loading persons:", error);
            throw error;
        }
    }

    static async addPerson(personData: { name: string }): Promise<void> {
        try {
            const baseSlug = generateSlug(personData.name);
            const slug = await getUniqueSlug(baseSlug);

            const { error } = await supabase
                .from("persons")
                .insert({ name: personData.name, slug });

            if (error) throw error;
        } catch (error) {
            console.error("Error adding person:", error);
            throw error;
        }
    }

    static async updatePerson(
        id: string,
        personData: { name: string },
    ): Promise<void> {
        try {
            const baseSlug = generateSlug(personData.name);
            const slug = await getUniqueSlug(baseSlug, id);

            const { error } = await supabase
                .from("persons")
                .update({ name: personData.name, slug })
                .eq("id", id);

            if (error) throw error;
        } catch (error) {
            console.error("Error updating person:", error);
            throw error;
        }
    }

    static async deletePerson(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from("persons")
                .delete()
                .eq("id", id);

            if (error) throw error;
        } catch (error) {
            console.error("Error deleting person:", error);
            throw error;
        }
    }

    static async loadPerson(id: string): Promise<Person | null> {
        try {
            const { data, error } = await supabase
                .from("persons")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Error loading person:", error);
            throw error;
        }
    }

    static async loadPersonBySlug(slug: string): Promise<Person | null> {
        try {
            const { data, error } = await supabase
                .from("persons")
                .select("*")
                .eq("slug", slug)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Error loading person by slug:", error);
            throw error;
        }
    }
}

