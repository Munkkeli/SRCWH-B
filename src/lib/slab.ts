import { PoolClient } from 'pg';

export interface Slab {
  id?: string;
  coordinates: { x: number; y: number };
  location: string;
}

export const get = async ({ trx, slab }: { trx: PoolClient; slab: string }) => {
  const { rows } = await trx.query(
    'SELECT id, coordinates, location FROM "slab" WHERE id = $1',
    [slab]
  );

  if (!rows.length) throw new Error('Failed to find slab');

  return {
    id: rows[0].id.toString(),
    coordinates: rows[0].coordinates,
    location: rows[0].location
  } as Slab;
};

export const create = async ({
  trx,
  slab
}: {
  trx: PoolClient;
  slab: Slab;
}) => {
  const { rows } = await trx.query(
    'INSERT INTO "slab" (coordinates, location) VALUES ($1, $2) RETURNING id',
    [slab.coordinates, slab.location]
  );

  if (!rows.length) throw new Error('Could not create slab');

  return {
    id: rows[0].id.toString(),
    coordinates: rows[0].coordinates,
    location: rows[0].location
  } as Slab;
};
