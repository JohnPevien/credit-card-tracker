import { supabase, Person } from "@/lib/supabase";

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
            const { error } = await supabase
                .from("persons")
                .insert({ name: personData.name });

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
            const { error } = await supabase
                .from("persons")
                .update({ name: personData.name })
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
}
