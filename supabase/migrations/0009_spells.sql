-- =============================================================================
-- Ember — spells
-- =============================================================================
-- Global reference data, not campaign-scoped — a spell means the same thing
-- in every campaign, the same way a damage type or condition name does.
-- Unlike those (plain zod enums, no table needed), spells carry enough rich
-- text that a table makes more sense than an enum.
--
-- The content model has to support Ember's own original spells alongside
-- SRD ones (CLAUDE.md: "the handbook contains original classes and races,
-- not just SRD content... must support original classes and subclasses, not
-- just a seeded SRD dump") — `source` marks which is which. No write policy
-- yet: these are seeded here, not user-editable. A real "spell management"
-- surface is a future migration's problem, same as everything else not
-- built yet.
-- =============================================================================

create table public.spells (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level integer not null check (level between 0 and 9),
  school text not null check (
    school in (
      'abjuration', 'conjuration', 'divination', 'enchantment',
      'evocation', 'illusion', 'necromancy', 'transmutation'
    )
  ),
  casting_time text not null,
  range text not null,
  components text not null,
  duration text not null,
  concentration boolean not null default false,
  ritual boolean not null default false,
  description text not null,
  higher_levels text,
  source text not null default 'srd' check (source in ('srd', 'original')),
  created_at timestamptz not null default now()
);

create index spells_level_idx on public.spells (level);

alter table public.spells enable row level security;

create policy "spells_select_all_authenticated"
  on public.spells for select
  to authenticated
  using (true);

grant select on public.spells to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: a representative spread of real SRD 5.2.1 spells (cantrip-3rd level,
-- damage/utility/buff/healing), plus one original spell already named in
-- the existing Sorcerer spell list (Notion, "SORCERER SPELL LIST") with no
-- mechanics written yet — this fills that gap with a conservative Fire Bolt
-- reskin rather than inventing new mechanics wholesale.
-- ---------------------------------------------------------------------------

insert into public.spells
  (name, level, school, casting_time, range, components, duration, concentration, ritual, description, higher_levels, source)
values
  ('Fire Bolt', 0, 'evocation', '1 action', '120 feet', 'V, S', 'Instantaneous', false, false,
   'You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. A flammable object hit by this spell ignites if it isn''t being worn or carried.',
   'This spell''s damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).',
   'srd'),
  ('Ray of Frost', 0, 'evocation', '1 action', '60 feet', 'V, S', 'Instantaneous', false, false,
   'A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, it takes 1d8 cold damage, and its speed is reduced by 10 feet until the start of your next turn.',
   'The damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).',
   'srd'),
  ('Mage Hand', 0, 'conjuration', '1 action', '30 feet', 'V, S', '1 minute', false, false,
   'A spectral, floating hand appears at a point you choose within range. You can use the hand to manipulate an object, open an unlocked door or container, stow or retrieve an item, or pour the contents of a vial. The hand can''t attack, activate magic items, or carry more than 10 pounds.',
   null, 'srd'),
  ('Light', 0, 'evocation', '1 action', 'Touch', 'V, M', '1 hour', false, false,
   'You touch one object no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet.',
   null, 'srd'),
  ('Acid Splash', 0, 'conjuration', '1 action', '60 feet', 'V, S', 'Instantaneous', false, false,
   'You hurl a bubble of acid at one creature, or at two creatures within 5 feet of each other. A target must succeed on a Dexterity saving throw or take 1d6 acid damage.',
   'The damage increases by 1d6 when you reach 5th level (2d6), 11th level (3d6), and 17th level (4d6).',
   'srd'),
  ('Magic Missile', 1, 'evocation', '1 action', '120 feet', 'V, S', 'Instantaneous', false, false,
   'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range, dealing 1d4 + 1 force damage. The darts all strike simultaneously.',
   'When you cast this spell using a spell slot of 2nd level or higher, the spell creates one more dart for each slot level above 1st.',
   'srd'),
  ('Cure Wounds', 1, 'evocation', '1 action', 'Touch', 'V, S', 'Instantaneous', false, false,
   'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.',
   'When you cast this spell using a spell slot of 2nd level or higher, the healing increases by 1d8 for each slot level above 1st.',
   'srd'),
  ('Shield', 1, 'abjuration', '1 reaction', 'Self', 'V, S', '1 round', false, false,
   'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, and you take no damage from magic missile.',
   null, 'srd'),
  ('Burning Hands', 1, 'evocation', '1 action', 'Self (15-foot cone)', 'V, S', 'Instantaneous', false, false,
   'Each creature in a 15-foot cone must make a Dexterity saving throw, taking 3d6 fire damage on a failed save, or half as much on a successful one. Flammable objects in the area that aren''t worn or carried start burning.',
   'When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d6 for each slot level above 1st.',
   'srd'),
  ('Mage Armor', 1, 'abjuration', '1 action', 'Touch', 'V, S, M', '8 hours', false, false,
   'You touch a willing creature who isn''t wearing armor, and a protective magical force surrounds it until the spell ends. The target''s base AC becomes 13 + its Dexterity modifier.',
   null, 'srd'),
  ('Thunderwave', 1, 'evocation', '1 action', 'Self (15-foot cube)', 'V, S', 'Instantaneous', false, false,
   'Each creature in a 15-foot cube must make a Constitution saving throw, taking 2d8 thunder damage on a failed save (half as much on a success), and is pushed 10 feet away on a failed save.',
   'When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d8 for each slot level above 1st.',
   'srd'),
  ('Scorching Ray', 2, 'evocation', '1 action', '120 feet', 'V, S', 'Instantaneous', false, false,
   'You create three rays of fire and hurl them at targets within range. Make a ranged spell attack for each ray. On a hit, the target takes 2d6 fire damage.',
   'When you cast this spell using a spell slot of 3rd level or higher, you create one additional ray for each slot level above 2nd.',
   'srd'),
  ('Misty Step', 2, 'conjuration', '1 bonus action', 'Self', 'V', 'Instantaneous', false, false,
   'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.',
   null, 'srd'),
  ('Fireball', 3, 'evocation', '1 action', '150 feet', 'V, S, M', 'Instantaneous', false, false,
   'A bright streak flashes to a point you choose and blossoms into a 20-foot-radius sphere of fire. Each creature in the area must make a Dexterity saving throw, taking 8d6 fire damage on a failed save, or half as much on a successful one.',
   'When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
   'srd'),
  ('Lightning Bolt', 3, 'evocation', '1 action', 'Self (100-foot line)', 'V, S, M', 'Instantaneous', false, false,
   'A stroke of lightning forming a line 100 feet long and 5 feet wide blasts out from you. Each creature in the line must make a Dexterity saving throw, taking 8d6 lightning damage on a failed save, or half as much on a successful one.',
   'When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
   'srd'),
  ('Shock Spark', 0, 'evocation', '1 action', '120 feet', 'V, S', 'Instantaneous', false, false,
   'A crackling mote of electricity leaps from your fingers toward a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 lightning damage.',
   'This spell''s damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).',
   'original');
