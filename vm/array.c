#include <common.h>

Array * create_array(U64 length, U64 elementSize) {
	const initial_size = 64;
	length = length * elementSize >= initial_size ? length : elementSize >= initial_size ? 1 : initial_size / elementSize;
	Array * result = malloc(sizeof(Array));
	result->length = length;
	result->capacity = length;
	result->elementSize = elementSize;
	result->data = malloc(length * elementSize);
	return result;
}

void free_array(Array * array) {
	free(array->data);
	free(array);
}

void * array_get(Array * array, U64 index) {
	return array->data + index * array->elementSize;
}

void array_set(Array * array, U64 index, void * value) {
	memcpy(array_get(array, index), value, array->elementSize);
}

void array_push(Array * array, void * value) {
	if (array->length == array->capacity) {
		array->capacity *= 2;
		array->data = realloc(array->data, array->capacity * array->elementSize);
	}
	array_set(array, array->length, value);
	array->length++;
}
