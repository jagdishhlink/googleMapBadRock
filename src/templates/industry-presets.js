const INDUSTRY_PRESETS = {
  restaurant: {
    pages: ['home', 'menu', 'reservations', 'gallery', 'about', 'contact'],
    features: ['online_menu', 'reservation_system', 'photo_gallery', 'reviews_widget'],
    sections: {
      home: ['hero', 'featured_dishes', 'testimonials', 'hours_location', 'cta'],
      menu: ['categories', 'items_grid', 'dietary_filters', 'specials'],
      about: ['story', 'team', 'values', 'awards'],
    },
    style: 'warm',
  },
  dental_clinic: {
    pages: ['home', 'services', 'team', 'appointments', 'testimonials', 'contact'],
    features: ['appointment_booking', 'service_catalog', 'team_profiles', 'insurance_info'],
    sections: {
      home: ['hero', 'services_overview', 'team_preview', 'testimonials', 'cta'],
      services: ['service_cards', 'procedure_details', 'faq'],
      team: ['doctor_profiles', 'credentials', 'philosophy'],
    },
    style: 'clean',
  },
  law_firm: {
    pages: ['home', 'practice-areas', 'attorneys', 'results', 'blog', 'contact'],
    features: ['consultation_form', 'case_results', 'attorney_profiles', 'blog'],
    sections: {
      home: ['hero', 'practice_areas', 'results_counter', 'testimonials', 'cta'],
      'practice-areas': ['area_cards', 'detailed_description', 'related_cases'],
      attorneys: ['profiles_grid', 'bio_detail', 'credentials'],
    },
    style: 'authoritative',
  },
  salon: {
    pages: ['home', 'services', 'gallery', 'team', 'booking', 'contact'],
    features: ['booking_system', 'service_pricing', 'portfolio_gallery', 'stylist_profiles'],
    sections: {
      home: ['hero', 'services_preview', 'before_after', 'testimonials', 'booking_cta'],
      services: ['categories', 'pricing_table', 'add_ons'],
      gallery: ['portfolio_grid', 'before_after_slider'],
    },
    style: 'elegant',
  },
  gym: {
    pages: ['home', 'programs', 'trainers', 'schedule', 'membership', 'contact'],
    features: ['class_schedule', 'membership_plans', 'trainer_profiles', 'virtual_tour'],
    sections: {
      home: ['hero', 'programs_overview', 'trainers_preview', 'membership_cta', 'results'],
      programs: ['class_cards', 'schedule_preview', 'difficulty_levels'],
      membership: ['plan_comparison', 'pricing_table', 'faq'],
    },
    style: 'energetic',
  },
  hotel: {
    pages: ['home', 'rooms', 'amenities', 'dining', 'events', 'gallery', 'contact'],
    features: ['room_booking', 'room_gallery', 'amenity_showcase', 'event_spaces'],
    sections: {
      home: ['hero_video', 'rooms_preview', 'amenities_highlights', 'testimonials'],
      rooms: ['room_types', 'comparison', 'virtual_tour'],
      amenities: ['facility_grid', 'spa_services', 'pool_info'],
    },
    style: 'luxurious',
  },
  retail: {
    pages: ['home', 'products', 'about', 'locations', 'contact'],
    features: ['product_showcase', 'store_locator', 'brand_story', 'newsletter'],
    sections: {
      home: ['hero', 'featured_products', 'categories', 'brand_values', 'newsletter'],
      products: ['category_grid', 'product_cards', 'filters'],
      about: ['brand_story', 'timeline', 'values', 'team'],
    },
    style: 'modern',
  },
};

export function getPreset(industry) {
  if (!industry) return getDefaultPreset();
  const normalized = industry.toLowerCase().replace(/[\s-]/g, '_');
  for (const [key, preset] of Object.entries(INDUSTRY_PRESETS)) {
    if (key.includes(normalized) || normalized.includes(key)) return preset;
  }
  return getDefaultPreset();
}

function getDefaultPreset() {
  return {
    pages: ['home', 'services', 'about', 'contact'],
    features: ['contact_form', 'service_showcase', 'testimonials'],
    sections: {
      home: ['hero', 'services_overview', 'testimonials', 'cta'],
      about: ['story', 'team', 'values'],
    },
    style: 'modern',
  };
}

export { INDUSTRY_PRESETS };
