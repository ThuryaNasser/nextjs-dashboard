'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';


const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce.number()
        .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
});

// Use Zod to update the expected types
const invoice = FormSchema.omit({ id: true, date: true });

function prepareInvoice(formData: FormData) {
    const validatedFields = invoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    // Prepare data for insertion into the database
    const amountInCents = validatedFields.data.amount * 100;
    const date = new Date().toISOString().split('T')[0]; //invoice's creation date
    return { ...validatedFields.data, amountInCents, date };
}

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    const invoice = prepareInvoice(formData);
    if (invoice.errors) {
        return invoice;
    }
    const { customerId, amountInCents, status, date } = invoice;
    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
      `;

    } catch (error) {
        return {
            message: `Database Error: Failed to Create Invoice,\n error: ${error}`,
        };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    const invoice = prepareInvoice(formData);
    if (invoice.errors) {
        return invoice;
    }
    const { customerId, amountInCents, status } = invoice;

    try {
        await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
    } catch (error) {
        return {
            message: `Database Error: Failed to Create Invoice.\n error: ${error}`,
        };
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
    } catch (error) {
        return {
            message: `Database Error: Failed to Create Invoice, \n error: ${error}`,
        };
    }
}