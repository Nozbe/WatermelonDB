#pragma once

#include <jsi/jsi.h>
#include "Database.h"

void jumpToDatabaseBatch(watermelondb::Database *db, jsi::Runtime& rt, jsi::Array& operations);
